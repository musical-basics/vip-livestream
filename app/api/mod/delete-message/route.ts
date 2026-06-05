import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { canModerateChat } from '@/lib/roles'
import { createServiceClient } from '@/lib/supabase-server'
import { createClient as createBrowserClient } from '@supabase/supabase-js'

export async function DELETE(request: NextRequest) {
  const member = await getSession()
  if (!canModerateChat(member)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { message_id, stream_id } = await request.json()
  if (!message_id || !stream_id) {
    return NextResponse.json({ error: 'message_id and stream_id required' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('chat_messages')
    .delete()
    .eq('id', message_id)
    .eq('stream_id', stream_id)
    .select('id')
    .maybeSingle()

  if (error) return NextResponse.json({ error: 'Failed to delete message' }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Message not found' }, { status: 404 })

  const realtimeClient = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const channel = realtimeClient.channel(`stream:${stream_id}`)
  await channel.send({
    type: 'broadcast',
    event: 'delete_message',
    payload: { message_id },
  })

  return NextResponse.json({ success: true })
}
