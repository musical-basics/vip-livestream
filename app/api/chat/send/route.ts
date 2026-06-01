import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase-server'
import { createClient as createBrowserClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  const member = await getSession()
  if (!member) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { stream_id, content, emoji, display_name } = await request.json()

  if (!stream_id) return NextResponse.json({ error: 'stream_id required' }, { status: 400 })
  if (!content && !emoji) return NextResponse.json({ error: 'content or emoji required' }, { status: 400 })

  const supabase = createServiceClient()

  // Check for active timeout
  const { data: timeout } = await supabase
    .from('member_timeouts')
    .select('id, timeout_until')
    .eq('member_id', member.id)
    .eq('stream_id', stream_id)
    .or(`timeout_until.is.null,timeout_until.gt.${new Date().toISOString()}`)
    .limit(1)
    .single()

  if (timeout) {
    return NextResponse.json({ error: 'You are timed out' }, { status: 403 })
  }

  // Insert message
  const { data: message, error } = await supabase
    .from('chat_messages')
    .insert({
      stream_id,
      member_id: member.id,
      display_name: display_name || member.display_name || member.name,
      content: content || null,
      emoji: emoji || null,
      is_muted: false,
    })
    .select()
    .single()

  if (error || !message) {
    return NextResponse.json({ error: 'Failed to send' }, { status: 500 })
  }

  // Broadcast via Supabase Realtime
  const realtimeClient = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const channel = realtimeClient.channel(`stream:${stream_id}`)
  await channel.send({
    type: 'broadcast',
    event: 'new_message',
    payload: message,
  })

  return NextResponse.json({ message })
}
