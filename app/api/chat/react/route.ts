import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase-server'
import { createClient as createBrowserClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  const member = await getSession()
  if (!member) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { message_id, emoji, stream_id } = await request.json()

  if (!message_id || !emoji || !stream_id) {
    return NextResponse.json({ error: 'message_id, emoji, and stream_id required' }, { status: 400 })
  }

  const supabase = createServiceClient()

  // Retrieve current message to toggle reaction
  const { data: message, error: fetchError } = await supabase
    .from('chat_messages')
    .select('reactions')
    .eq('id', message_id)
    .single()

  if (fetchError || !message) {
    return NextResponse.json({ error: 'Message not found' }, { status: 404 })
  }

  const reactions = { ...((message.reactions as Record<string, string[]>) || {}) }
  const currentList = reactions[emoji] ? [...reactions[emoji]] : []

  const index = currentList.indexOf(member.id)
  if (index > -1) {
    // Remove user reaction
    currentList.splice(index, 1)
  } else {
    // Add user reaction
    currentList.push(member.id)
  }

  if (currentList.length > 0) {
    reactions[emoji] = currentList
  } else {
    delete reactions[emoji]
  }

  // Update reactions in the database
  const { error: updateError } = await supabase
    .from('chat_messages')
    .update({ reactions })
    .eq('id', message_id)

  if (updateError) {
    return NextResponse.json({ error: 'Failed to update reaction' }, { status: 500 })
  }

  // Broadcast reaction update to all viewers
  const realtimeClient = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const channel = realtimeClient.channel(`stream:${stream_id}`)
  await channel.send({
    type: 'broadcast',
    event: 'message_reaction',
    payload: {
      message_id,
      reactions,
    },
  })

  return NextResponse.json({ message_id, reactions })
}
