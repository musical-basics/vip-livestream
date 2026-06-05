import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase-server'
import { createClient as createBrowserClient } from '@supabase/supabase-js'
import { canModerateChat } from '@/lib/roles'
import { DEFAULT_SLOW_MODE_DELAY_SECONDS } from '@/lib/chat-settings'

const MAX_CONTENT_LENGTH = 500
const MAX_EMOJI_LENGTH = 32
const MAX_DISPLAY_NAME_LENGTH = 80
const RATE_LIMIT_WINDOW_SECONDS = 10
const RATE_LIMIT_MAX_MESSAGES = 8

export async function POST(request: NextRequest) {
  const member = await getSession()
  if (!member) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { stream_id, content, emoji, display_name } = await request.json()
  const messageContent = typeof content === 'string' ? content.trim() : ''
  const messageEmoji = typeof emoji === 'string' ? emoji.trim() : ''
  const displayName = typeof display_name === 'string' && display_name.trim()
    ? display_name.trim().slice(0, MAX_DISPLAY_NAME_LENGTH)
    : member.display_name || member.name

  if (!stream_id) return NextResponse.json({ error: 'stream_id required' }, { status: 400 })
  if (!messageContent && !messageEmoji) {
    return NextResponse.json({ error: 'content or emoji required' }, { status: 400 })
  }
  if (messageContent.length > MAX_CONTENT_LENGTH) {
    return NextResponse.json({ error: 'message is too long' }, { status: 400 })
  }
  if (messageEmoji.length > MAX_EMOJI_LENGTH) {
    return NextResponse.json({ error: 'emoji is too long' }, { status: 400 })
  }

  const supabase = createServiceClient()

  // Check for active timeout
  const { data: timeout } = await supabase
    .from('member_timeouts')
    .select('id, timeout_until')
    .eq('member_id', member.id)
    .eq('stream_id', stream_id)
    .or(`timeout_until.is.null,timeout_until.gt.${new Date().toISOString()}`)
    .limit(1)
    .maybeSingle()

  if (timeout) {
    return NextResponse.json({ error: 'You are timed out' }, { status: 403 })
  }

  // Check for active slow mode delay
  const { data: stream, error: streamError } = await supabase
    .from('streams')
    .select('slow_mode_delay')
    .eq('id', stream_id)
    .single()

  const slowModeDelay = streamError
    ? DEFAULT_SLOW_MODE_DELAY_SECONDS
    : stream?.slow_mode_delay ?? DEFAULT_SLOW_MODE_DELAY_SECONDS

  if (slowModeDelay > 0 && !canModerateChat(member)) {
    const slowModeSince = new Date(Date.now() - slowModeDelay * 1000).toISOString()
    const { data: lastMessage } = await supabase
      .from('chat_messages')
      .select('created_at')
      .eq('member_id', member.id)
      .eq('stream_id', stream_id)
      .gte('created_at', slowModeSince)
      .limit(1)
      .maybeSingle()

    if (lastMessage) {
      return NextResponse.json(
        { error: `Slow mode is active. You must wait ${slowModeDelay} seconds between messages.` },
        { status: 429 }
      )
    }
  }

  const rateLimitSince = new Date(Date.now() - RATE_LIMIT_WINDOW_SECONDS * 1000).toISOString()
  const { count: recentMessageCount } = await supabase
    .from('chat_messages')
    .select('id', { count: 'exact', head: true })
    .eq('member_id', member.id)
    .eq('stream_id', stream_id)
    .gte('created_at', rateLimitSince)

  if ((recentMessageCount ?? 0) >= RATE_LIMIT_MAX_MESSAGES) {
    return NextResponse.json(
      { error: 'Please slow down for a moment before sending another chat message.' },
      { status: 429 }
    )
  }

  // Insert message
  const { data: message, error } = await supabase
    .from('chat_messages')
    .insert({
      stream_id,
      member_id: member.id,
      display_name: displayName,
      content: messageEmoji ? null : messageContent,
      emoji: messageEmoji || null,
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
