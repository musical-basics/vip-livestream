import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { canModerateChat } from '@/lib/roles'
import { createServiceClient } from '@/lib/supabase-server'
import { createClient as createBrowserClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  const member = await getSession()
  if (!canModerateChat(member)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { message_id, stream_id } = await request.json()

  const supabase = createServiceClient()

  await supabase
    .from('chat_messages')
    .update({ is_muted: true })
    .eq('id', message_id)

  // Broadcast so all clients hide the message immediately
  const realtimeClient = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const channel = realtimeClient.channel(`stream:${stream_id}`)
  await channel.send({
    type: 'broadcast',
    event: 'mute_message',
    payload: { message_id },
  })

  return NextResponse.json({ success: true })
}
