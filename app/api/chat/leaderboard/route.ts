import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase-server'
import { membersHaveNameColor, memberSelect } from '@/lib/optional-columns'

export async function GET(request: NextRequest) {
  const member = await getSession()
  if (!member) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const streamId = searchParams.get('stream_id')
  const scope = searchParams.get('scope') || 'current'

  if (scope === 'current' && !streamId) {
    return NextResponse.json({ error: 'Stream ID is required for current show scope' }, { status: 400 })
  }

  const supabase = createServiceClient()

  // 1. Try PostgreSQL RPC aggregation (recommended, scales well)
  try {
    const { data: rpcData, error: rpcError } = await supabase
      .rpc('get_scoped_top_chatters', {
        p_scope: scope,
        p_stream_id: scope === 'current' ? streamId : null,
        p_limit: 20
      })

    if (!rpcError && rpcData) {
      return NextResponse.json({ leaderboard: rpcData })
    }

    console.warn(`RPC for scope ${scope} failed or not found, falling back to JS aggregation:`, rpcError)
  } catch (err) {
    console.error('RPC invocation error:', err)
  }

  // 2. JS Fallback Aggregation (safe default if migration hasn't been run)
  try {
    let messageQuery = supabase
      .from('chat_messages')
      .select('member_id, display_name, content')
      .eq('is_muted', false)
      .limit(5000) // limit to avoid memory pressure on large chat histories

    if (scope === 'current') {
      messageQuery = messageQuery.eq('stream_id', streamId!)
    } else if (scope === 'weekly') {
      const weeklySince = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      messageQuery = messageQuery.gte('created_at', weeklySince)
    } else if (scope === 'monthly') {
      const monthlySince = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      messageQuery = messageQuery.gte('created_at', monthlySince)
    }

    // name_color is a pending migration in some environments; only request it
    // when present so the whole query doesn't 400 (which is what makes the
    // leaderboard fail to load entirely).
    const hasNameColor = await membersHaveNameColor(supabase)

    const [messagesRes, membersRes] = await Promise.all([
      messageQuery,
      supabase
        .from('members')
        .select(memberSelect(hasNameColor))
        .eq('is_admin', false)
        .eq('is_banned', false)
    ])

    if (messagesRes.error) throw messagesRes.error
    if (membersRes.error) throw membersRes.error

    type MemberRow = {
      id: string
      name: string
      display_name: string | null
      name_color?: string | null
      access_badges: string[]
      is_moderator: boolean
      is_admin: boolean
    }
    const memberRows = (membersRes.data ?? []) as unknown as MemberRow[]
    const memberMap = new Map(memberRows.map(m => [m.id, m]))
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
      if (!activeMember) continue
      
      // Exclude automated system notifications
      if (msg.content?.startsWith('[System]')) continue

      if (!tally[msg.member_id]) {
        tally[msg.member_id] = {
          member_id: msg.member_id,
          display_name: activeMember.display_name || activeMember.name,
          name: activeMember.name,
          name_color: (activeMember as { name_color?: string | null }).name_color ?? null,
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
  } catch (err) {
    console.error('JS aggregation fallback failed:', err)
    return NextResponse.json({ error: 'Failed to fetch leaderboard' }, { status: 500 })
  }
}
