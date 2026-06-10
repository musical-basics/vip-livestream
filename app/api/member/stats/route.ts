import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase-server'
import { membersHaveNameColor, memberSelect } from '@/lib/optional-columns'

export async function GET(request: NextRequest) {
  const sessionMember = await getSession()
  if (!sessionMember) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const memberId = searchParams.get('member_id')
  const streamId = searchParams.get('stream_id')

  if (!memberId) {
    return NextResponse.json({ error: 'Member ID is required' }, { status: 400 })
  }

  const supabase = createServiceClient()

  try {
    // 1. Query Member details. name_color is a pending migration in some
    // environments; only request it when present so this doesn't 400.
    const hasNameColor = await membersHaveNameColor(supabase)
    const { data: member, error: memberErr } = await supabase
      .from('members')
      .select(memberSelect(hasNameColor, ', created_at'))
      .eq('id', memberId)
      .maybeSingle()

    if (memberErr || !member) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }

    // 2. Query stats in parallel
    const [allTimeRes, currentShowRes, streamsRes] = await Promise.all([
      // All-time messages count
      supabase
        .from('chat_messages')
        .select('id', { count: 'exact', head: true })
        .eq('member_id', memberId)
        .eq('is_muted', false)
        .or('content.is.null,content.not.like.[System]%'),
      
      // Current show messages count (if streamId is provided)
      streamId
        ? supabase
            .from('chat_messages')
            .select('id', { count: 'exact', head: true })
            .eq('member_id', memberId)
            .eq('stream_id', streamId)
            .eq('is_muted', false)
            .or('content.is.null,content.not.like.[System]%')
        : Promise.resolve({ count: 0 }),

      // All messages to group by stream_id in JS for unique streams attended
      supabase
        .from('chat_messages')
        .select('stream_id')
        .eq('member_id', memberId)
        .eq('is_muted', false)
        .or('content.is.null,content.not.like.[System]%')
    ])

    const streamsAttended = new Set(streamsRes.data?.map(s => s.stream_id) || []).size

    return NextResponse.json({
      member,
      stats: {
        all_time_messages: allTimeRes.count || 0,
        current_show_messages: currentShowRes.count || 0,
        streams_attended: streamsAttended
      }
    })
  } catch (err) {
    console.error('Failed to query member stats:', err)
    return NextResponse.json({ error: 'Failed to retrieve stats' }, { status: 500 })
  }
}
