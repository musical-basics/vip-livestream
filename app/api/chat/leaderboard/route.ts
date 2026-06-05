import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
  const member = await getSession()
  if (!member) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const streamId = searchParams.get('stream_id')

  if (!streamId) {
    return NextResponse.json({ error: 'Stream ID is required' }, { status: 400 })
  }

  const supabase = createServiceClient()

  // 1. Try PostgreSQL RPC aggregation (recommended, scales well)
  try {
    const { data: rpcData, error: rpcError } = await supabase
      .rpc('get_top_chatters', { p_stream_id: streamId, p_limit: 20 })

    if (!rpcError && rpcData) {
      return NextResponse.json({ leaderboard: rpcData })
    }

    // If pg error is function not found (code 42883) or similar, fall back to JS aggregation
    console.warn('RPC get_top_chatters failed or not found, falling back to JS aggregation:', rpcError)
  } catch (err) {
    console.error('RPC invocation error:', err)
  }

  // 2. JS Fallback Aggregation (safe default if migration hasn't been run)
  try {
    const [messagesRes, membersRes] = await Promise.all([
      supabase
        .from('chat_messages')
        .select('member_id, display_name')
        .eq('stream_id', streamId)
        .eq('is_muted', false)
        .limit(3000), // reasonably large limit for active stream chat sizes
      supabase
        .from('members')
        .select('id, name, display_name, name_color, access_badges, is_moderator, is_admin')
        .eq('is_admin', false)
        .eq('is_banned', false)
    ])

    if (messagesRes.error) throw messagesRes.error
    if (membersRes.error) throw membersRes.error

    const memberMap = new Map(membersRes.data.map(m => [m.id, m]))
    const tally: Record<string, {
      member_id: string
      display_name: string
      name: string
      name_color: string | null
      access_badges: string[]
      is_moderator: boolean
      message_count: number
    }> = {}

    for (const msg of messagesRes.data) {
      const activeMember = memberMap.get(msg.member_id)
      // Exclude admin messages and deleted/banned members
      if (!activeMember) continue

      if (!tally[msg.member_id]) {
        tally[msg.member_id] = {
          member_id: msg.member_id,
          display_name: activeMember.display_name || activeMember.name,
          name: activeMember.name,
          name_color: activeMember.name_color,
          access_badges: activeMember.access_badges,
          is_moderator: activeMember.is_moderator,
          message_count: 0
        }
      }
      tally[msg.member_id].message_count++
    }

    const leaderboard = Object.values(tally)
      .sort((a, b) => b.message_count - a.message_count)
      .slice(0, 20)

    return NextResponse.json({ leaderboard })
  } catch (err: any) {
    console.error('JS aggregation fallback failed:', err)
    return NextResponse.json({ error: 'Failed to fetch leaderboard' }, { status: 500 })
  }
}
