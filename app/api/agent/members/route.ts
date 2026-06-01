import { NextRequest } from 'next/server'
import { verifyAgentKey, agentUnauthorized } from '@/lib/agent-auth'
import { createServiceClient } from '@/lib/supabase-server'
import crypto from 'crypto'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://vip.musicalbasics.com'

/**
 * GET /api/agent/members
 * List members. Optional query params:
 *   ?moderators_only=true   — only moderators
 *   ?banned=true            — only banned members
 *   ?banned=false           — only active members (default behaviour)
 */
export async function GET(request: NextRequest) {
  if (!verifyAgentKey(request)) return agentUnauthorized()

  const { searchParams } = new URL(request.url)
  const moderatorsOnly = searchParams.get('moderators_only') === 'true'
  const bannedFilter   = searchParams.get('banned')

  const supabase = createServiceClient()
  let query = supabase.from('members').select('*').order('created_at', { ascending: true })

  if (moderatorsOnly) query = query.eq('is_moderator', true)
  if (bannedFilter === 'true')  query = query.eq('is_banned', true)
  if (bannedFilter === 'false') query = query.eq('is_banned', false)

  const { data, error } = await query
  if (error) return Response.json({ error: error.message }, { status: 500 })

  // Attach invite links (never expose password_token directly in list — include it here for agent use)
  const members = (data ?? []).map(m => ({
    ...m,
    invite_link: `${APP_URL}?password=${m.password_token}`,
  }))

  return Response.json({ members, count: members.length })
}

/**
 * POST /api/agent/members
 * Add a new member. Returns their invite link.
 * Body: { name, email, is_moderator?, display_name? }
 */
export async function POST(request: NextRequest) {
  if (!verifyAgentKey(request)) return agentUnauthorized()

  const { name, email, is_moderator, display_name } = await request.json()
  if (!name || !email) return Response.json({ error: 'name and email are required' }, { status: 400 })

  const password_token = crypto.randomUUID()
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('members')
    .upsert(
      {
        name,
        email,
        password_token,
        display_name: display_name ?? name,
        is_moderator: is_moderator ?? false,
      },
      { onConflict: 'email', ignoreDuplicates: false }
    )
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({
    ok: true,
    member: data,
    invite_link: `${APP_URL}?password=${data.password_token}`,
  }, { status: 201 })
}

/**
 * PATCH /api/agent/members
 * Update a member's properties.
 * Body: { member_id, display_name?, is_moderator?, is_banned?, regenerate_token? }
 * If regenerate_token=true, a new password_token is issued and a new invite_link is returned.
 */
export async function PATCH(request: NextRequest) {
  if (!verifyAgentKey(request)) return agentUnauthorized()

  const { member_id, regenerate_token, ...rest } = await request.json()
  if (!member_id) return Response.json({ error: 'member_id is required' }, { status: 400 })

  const allowed = ['display_name', 'is_moderator', 'is_banned', 'name']
  const update: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in rest) update[key] = rest[key]
  }

  if (regenerate_token) {
    update.password_token = crypto.randomUUID()
  }

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('members')
    .update(update)
    .eq('id', member_id)
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({
    ok: true,
    member: data,
    ...(regenerate_token && { invite_link: `${APP_URL}?password=${data.password_token}` }),
  })
}

/**
 * DELETE /api/agent/members
 * Remove a member entirely.
 * Body: { member_id }
 */
export async function DELETE(request: NextRequest) {
  if (!verifyAgentKey(request)) return agentUnauthorized()

  const { member_id } = await request.json()
  if (!member_id) return Response.json({ error: 'member_id is required' }, { status: 400 })

  const supabase = createServiceClient()
  const { error } = await supabase.from('members').delete().eq('id', member_id)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true, deleted: member_id })
}
