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
 * POST /api/agent/moderation
 * Issue a timeout or permanent mute to a member.
 * Body: {
 *   action: "timeout" | "mute",
 *   member_id: string,
 *   stream_id: string,
 *   minutes?: number | null   — null or omitted = permanent
 *   moderator_member_id?: string  — optional, used as the "muted_by" reference
 * }
 */
export async function POST(request: NextRequest) {
  if (!verifyAgentKey(request)) return agentUnauthorized()

  const { action, member_id, stream_id, minutes, moderator_member_id } = await request.json()

  if (!action || !member_id || !stream_id) {
    return Response.json({ error: 'action, member_id, and stream_id are required' }, { status: 400 })
  }
  if (!['timeout', 'mute'].includes(action)) {
    return Response.json({ error: 'action must be "timeout" or "mute"' }, { status: 400 })
  }

  const supabase = createServiceClient()

  // Resolve the moderator_member_id — fall back to the first moderator or admin if not provided
  let muted_by = moderator_member_id
  if (!muted_by) {
    const { data: mod } = await supabase
      .from('members')
      .select('id')
      .or('is_moderator.eq.true,is_admin.eq.true')
      .limit(1)
      .single()
    muted_by = mod?.id
  }
  if (!muted_by) {
    return Response.json(
      { error: 'Could not resolve a moderator_member_id. Provide one or ensure at least one moderator exists.' },
      { status: 422 }
    )
  }

  const timeout_until = minutes != null
    ? new Date(Date.now() + minutes * 60 * 1000).toISOString()
    : null // null = permanent

  const { data, error } = await supabase
    .from('member_timeouts')
    .insert({ member_id, stream_id, muted_by, timeout_until })
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })

  // Broadcast so the targeted client becomes aware they're muted
  const rt = realtimeClient()
  const ch = rt.channel(`stream:${stream_id}`)
  await ch.send({
    type: 'broadcast',
    event: 'member_muted',
    payload: { member_id, timeout_until },
  })

  return Response.json({
    ok: true,
    timeout: data,
    message: timeout_until
      ? `Member muted until ${timeout_until}`
      : 'Member permanently muted',
  })
}

/**
 * DELETE /api/agent/moderation
 * Clear all active timeouts/mutes for a member in a specific stream.
 * Body: { member_id, stream_id }
 */
export async function DELETE(request: NextRequest) {
  if (!verifyAgentKey(request)) return agentUnauthorized()

  const { member_id, stream_id } = await request.json()
  if (!member_id || !stream_id) {
    return Response.json({ error: 'member_id and stream_id are required' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { error, count } = await supabase
    .from('member_timeouts')
    .delete({ count: 'exact' })
    .eq('member_id', member_id)
    .eq('stream_id', stream_id)

  if (error) return Response.json({ error: error.message }, { status: 500 })

  // Notify client that mute has been lifted
  const rt = realtimeClient()
  const ch = rt.channel(`stream:${stream_id}`)
  await ch.send({
    type: 'broadcast',
    event: 'member_unmuted',
    payload: { member_id },
  })

  return Response.json({ ok: true, cleared: count ?? 0, message: 'Timeouts cleared' })
}
