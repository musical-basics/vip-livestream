import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { deliverCredentials, type DeliverableMember } from '@/lib/credential-delivery'

/**
 * POST /api/request-credentials  (PUBLIC — no auth)
 *
 * Customer-facing "resend my access" endpoint for the login page. A buyer who
 * lost or never received their invitation enters the email they purchased with,
 * and we re-send the same credential email (one-click login link + email/password).
 *
 * Safe by construction: it only ever emails an address that ALREADY exists as a
 * member (a real livestream buyer). It cannot send mail to an arbitrary address,
 * so it is not a spam relay. Passwords are never rotated — deliverCredentials
 * reuses the member's stored password, so any link sent before keeps working.
 *
 * Body: { email: string, company?: string }   // `company` is a honeypot field
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Best-effort in-memory rate limit. Serverless instances are ephemeral, so this
// only throttles bursts that hit the same warm instance — enough to blunt casual
// abuse without a datastore. Resend's own send limits are the real backstop.
const WINDOW_MS = 60_000
const MAX_PER_WINDOW = 5
const hits = new Map<string, number[]>()

function rateLimited(key: string): boolean {
  const now = Date.now()
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS)
  recent.push(now)
  hits.set(key, recent)
  return recent.length > MAX_PER_WINDOW
}

type MemberRow = {
  id: string
  name: string
  email: string
  password_token: string | null
  is_banned: boolean
  credentials_sent_at?: string | null
}

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ ok: false, message: 'Invalid request.' }, { status: 400 })
  }

  const { email, company } = (body ?? {}) as { email?: unknown; company?: unknown }

  // Honeypot: real users never fill this hidden field. Pretend success silently.
  if (typeof company === 'string' && company.trim()) {
    return Response.json({
      ok: true,
      message: "If that email is on the guest list, your access is on the way. Check your inbox.",
    })
  }

  const normalized = typeof email === 'string' ? email.trim().toLowerCase() : ''
  if (!normalized || !EMAIL_RE.test(normalized)) {
    return Response.json({ ok: false, message: 'Please enter a valid email address.' }, { status: 400 })
  }

  const ip = (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown'
  if (rateLimited(ip) || rateLimited(`e:${normalized}`)) {
    return Response.json(
      { ok: false, message: 'Too many requests — please wait a minute and try again.' },
      { status: 429 }
    )
  }

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('members')
    .select('id, name, email, password_token, is_banned, credentials_sent_at')
    .eq('email', normalized)
    .maybeSingle()

  if (error) {
    console.error('[request-credentials] member lookup failed:', error.message)
    return Response.json(
      { ok: false, message: 'Something went wrong on our end. Please email lionel@musicalbasics.com.' },
      { status: 500 }
    )
  }

  const member = (data as MemberRow | null) ?? null
  if (!member || member.is_banned) {
    // Not a buyer (or access revoked). Say so plainly so they can try the right
    // address — the "guest list" is just public concert buyers, nothing sensitive.
    return Response.json({
      ok: false,
      status: 'not_found',
      message:
        "We couldn't find a livestream ticket for that email. Use the exact address you bought with, or contact lionel@musicalbasics.com.",
    })
  }

  const deliverable: DeliverableMember = {
    id: member.id,
    name: member.name,
    email: member.email,
    password_token: member.password_token,
    credentials_sent_at: member.credentials_sent_at,
  }

  const result = await deliverCredentials(deliverable, { client: supabase })
  if (!result.sent) {
    console.error('[request-credentials] delivery failed for', normalized, '-', result.error)
    return Response.json(
      {
        ok: false,
        message: 'We found your ticket but the email failed to send. Please email lionel@musicalbasics.com.',
      },
      { status: 502 }
    )
  }

  return Response.json({
    ok: true,
    status: 'sent',
    message: `Done — your access link and password are on the way to ${member.email}. Check your inbox (and your spam / promotions folder).`,
  })
}
