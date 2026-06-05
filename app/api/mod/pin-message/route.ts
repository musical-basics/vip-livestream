import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { canModerateChat } from '@/lib/roles'
import { createServiceClient } from '@/lib/supabase-server'
import { createClient as createBrowserClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  const member = await getSession()
  if (!member) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!canModerateChat(member)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { message_id, stream_id } = await request.json()

  if (!stream_id) {
    return NextResponse.json({ error: 'stream_id required' }, { status: 400 })
  }

  const supabase = createServiceClient()

  let pinnedMessagePayload = null

  if (message_id) {
    // Fetch the message content
    const { data: message, error: fetchError } = await supabase
      .from('chat_messages')
      .select('id, member_id, display_name, content, emoji, created_at')
      .eq('id', message_id)
      .single()

    if (fetchError || !message) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 })
    }

    pinnedMessagePayload = message
  }

  // Update the stream with the pinned message (or null to unpin)
  const { error: updateError } = await supabase
    .from('streams')
    .update({ pinned_message: pinnedMessagePayload })
    .eq('id', stream_id)

  if (updateError) {
    return NextResponse.json({ error: 'Failed to update stream' }, { status: 500 })
  }

  // Broadcast the update in real-time
  const realtimeClient = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const channel = realtimeClient.channel(`stream:${stream_id}`)
  await channel.send({
    type: 'broadcast',
    event: 'pinned_message_updated',
    payload: {
      pinned_message: pinnedMessagePayload,
    },
  })

  return NextResponse.json({ pinned_message: pinnedMessagePayload })
}
