import { NextRequest } from 'next/server'
import { verifyAgentKey, agentUnauthorized } from '@/lib/agent-auth'
import { createClient } from '@supabase/supabase-js'

/**
 * POST /api/agent/broadcast
 * Send a custom realtime broadcast event to all connected clients on a stream channel.
 *
 * Body: {
 *   stream_id: string,
 *   event: string,        — e.g. "announcement", "stream_live", "tip_received", etc.
 *   payload: object       — arbitrary data sent to clients
 * }
 *
 * Common events the client UI handles:
 *   "new_message"     — payload: ChatMessage
 *   "mute_message"    — payload: { message_id }
 *   "member_muted"    — payload: { member_id, timeout_until? }
 *   "member_unmuted"  — payload: { member_id }
 *   "stream_live"     — payload: { stream_id, is_live: true }
 *   "stream_ended"    — payload: { stream_id, is_live: false }
 *   "tip_received"    — payload: { name, amount, message? }
 *   "announcement"    — payload: { text }  (custom — add client handler to show banner)
 */
export async function POST(request: NextRequest) {
  if (!verifyAgentKey(request)) return agentUnauthorized()

  const { stream_id, event, payload } = await request.json()

  if (!stream_id || !event) {
    return Response.json({ error: 'stream_id and event are required' }, { status: 400 })
  }

  const rt = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const channel = rt.channel(`stream:${stream_id}`)
  const result = await channel.send({
    type: 'broadcast',
    event,
    payload: payload ?? {},
  })

  if (result === 'error') {
    return Response.json({ error: 'Failed to broadcast — is the stream channel active?' }, { status: 500 })
  }

  return Response.json({ ok: true, event, stream_id })
}
