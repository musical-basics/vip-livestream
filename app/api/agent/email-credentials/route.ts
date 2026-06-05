import { NextRequest } from 'next/server'
import { verifyAgentKey, agentUnauthorized } from '@/lib/agent-auth'
import { createServiceClient } from '@/lib/supabase-server'
import {
  renderCredentialsEmail,
  sendCredentialsEmail,
  makePassword,
} from '@/lib/livestream-email'
import type { Member } from '@/lib/database.types'

const MAX_RECIPIENTS = 25
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * POST /api/agent/email-credentials
 * Email the livestream login credentials (auto-login link + email/password) to
 * one or more existing members, on demand. Use this for "my password doesn't
 * work" / "resend my invite" requests.
 *
 * Body (provide at least one): { member_id?, email?, emails?: string[] }
 *
 * Reuses each member's stored password (no rotation). A member who somehow has
 * no password yet is assigned one (initial assignment) before sending.
 */
export async function POST(request: NextRequest) {
  if (!verifyAgentKey(request)) return agentUnauthorized()

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { member_id, email, emails } = (body ?? {}) as {
    member_id?: unknown
    email?: unknown
    emails?: unknown
  }

  const wantedIds = new Set<string>()
  const wantedEmails = new Set<string>()
  if (typeof member_id === 'string' && member_id.trim()) wantedIds.add(member_id.trim())
  if (typeof email === 'string' && email.trim()) wantedEmails.add(email.trim().toLowerCase())
  if (Array.isArray(emails)) {
    for (const e of emails) {
      if (typeof e === 'string' && e.trim()) wantedEmails.add(e.trim().toLowerCase())
    }
  }

  if (wantedIds.size === 0 && wantedEmails.size === 0) {
    return Response.json(
      { error: 'Provide member_id, email, or emails[] (one or more)' },
      { status: 400 }
    )
  }

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('members')
    .select('id, name, email, password_token, is_banned')
  if (error) return Response.json({ error: error.message }, { status: 500 })

  const allMembers = (data ?? []) as Pick<
    Member,
    'id' | 'name' | 'email' | 'password_token' | 'is_banned'
  >[]

  const recipients = allMembers.filter(
    (m) => wantedIds.has(m.id) || wantedEmails.has((m.email || '').toLowerCase())
  )

  // Report identifiers that matched no member, so the caller knows.
  const matchedEmails = new Set(recipients.map((m) => m.email.toLowerCase()))
  const matchedIds = new Set(recipients.map((m) => m.id))
  const notFound = [
    ...[...wantedEmails].filter((e) => !matchedEmails.has(e)),
    ...[...wantedIds].filter((id) => !matchedIds.has(id)),
  ]

  if (recipients.length === 0) {
    return Response.json({ error: 'No matching members', not_found: notFound }, { status: 404 })
  }
  if (recipients.length > MAX_RECIPIENTS) {
    return Response.json(
      {
        error: `Too many recipients (${recipients.length}). This endpoint is for one-off sends; max ${MAX_RECIPIENTS}. For a full send use scripts/email-livestream-credentials.mjs.`,
      },
      { status: 400 }
    )
  }

  const results: Array<{ email: string; ok: boolean; id?: string; error?: string; banned?: boolean }> = []

  for (const m of recipients) {
    try {
      // Reuse the stored password; only assign one if the member has none.
      let password = m.password_token
      if (!password) {
        password = makePassword()
        const { error: upErr } = await supabase
          .from('members')
          .update({ password_token: password })
          .eq('id', m.id)
        if (upErr) throw new Error(`DB update: ${upErr.message}`)
      }

      const { subject, html, text } = renderCredentialsEmail({
        name: m.name,
        email: m.email,
        password,
        memberId: m.id,
      })
      const id = await sendCredentialsEmail({ to: m.email, subject, html, text })
      results.push({ email: m.email, ok: true, id, ...(m.is_banned && { banned: true }) })
    } catch (e) {
      results.push({ email: m.email, ok: false, error: e instanceof Error ? e.message : 'send failed' })
    }
    // Stay under Resend's 5 req/s limit.
    await sleep(300)
  }

  const sent = results.filter((r) => r.ok).length
  return Response.json({
    ok: sent > 0,
    sent,
    total: recipients.length,
    results,
    ...(notFound.length && { not_found: notFound }),
  })
}
