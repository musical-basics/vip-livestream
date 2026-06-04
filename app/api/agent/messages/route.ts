import { NextRequest } from 'next/server'
import { verifyAgentKey, agentUnauthorized } from '@/lib/agent-auth'
import { createServiceClient } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'

function realtimeClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

/**
 * GET /api/agent/messages
 * Retrieve chat messages for a stream.
 * Query: ?stream_id=<uuid>&limit=50&include_muted=true
 */
export async function GET(request: NextRequest) {
  if (!verifyAgentKey(request)) return agentUnauthorized()

  const { searchParams } = new URL(request.url)
  const stream_id     = searchParams.get('stream_id')
  const limit         = Math.min(parseInt(searchParams.get('limit') ?? '100'), 500)
  const includeMuted  = searchParams.get('include_muted') === 'true'

  if (!stream_id) return Response.json({ error: 'stream_id query param is required' }, { status: 400 })

  const supabase = createServiceClient()
  let query = supabase
    .from('chat_messages')
    .select('*')
    .eq('stream_id', stream_id)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (!includeMuted) query = query.eq('is_muted', false)

  const { data, error } = await query
  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ messages: (data ?? []).reverse(), count: data?.length ?? 0 })
}

/**
 * PATCH /api/agent/messages
 * Mute or unmute a specific chat message.
 * Body: { message_id, stream_id, is_muted: true|false }
 */
export async function PATCH(request: NextRequest) {
  if (!verifyAgentKey(request)) return agentUnauthorized()

  const { message_id, stream_id, is_muted } = await request.json()
  if (!message_id || !stream_id || typeof is_muted !== 'boolean') {
    return Response.json(
      { error: 'message_id, stream_id, and is_muted (boolean) are required' },
      { status: 400 }
    )
  }

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('chat_messages')
    .update({ is_muted })
    .eq('id', message_id)
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })

  // Broadcast to connected clients so the message hides/shows in real time
  const rt = realtimeClient()
  const ch = rt.channel(`stream:${stream_id}`)
  await ch.send({
    type: 'broadcast',
    event: is_muted ? 'mute_message' : 'unmute_message',
    payload: { message_id },
  })

  return Response.json({ ok: true, message: data })
}

/**
 * DELETE /api/agent/messages
 * Delete a specific chat message.
 * Body: { message_id, stream_id }
 */
export async function DELETE(request: NextRequest) {
  if (!verifyAgentKey(request)) return agentUnauthorized()

  const { message_id, stream_id } = await request.json()
  if (!message_id || !stream_id) {
    return Response.json({ error: 'message_id and stream_id are required' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('chat_messages')
    .delete()
    .eq('id', message_id)
    .eq('stream_id', stream_id)
    .select('id')
    .maybeSingle()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  if (!data) return Response.json({ error: 'Message not found' }, { status: 404 })

  const rt = realtimeClient()
  const ch = rt.channel(`stream:${stream_id}`)
  await ch.send({
    type: 'broadcast',
    event: 'delete_message',
    payload: { message_id },
  })

  return Response.json({ ok: true, deleted: message_id })
}
