import { createServiceClient } from '@/lib/supabase-server'
import {
  renderCredentialsEmail,
  sendCredentialsEmail,
  makePassword,
} from '@/lib/livestream-email'

/**
 * Deliver livestream login credentials to a member and record that we sent them.
 *
 * Shared by the Shopify webhook (auto-send on purchase) and the bulk script so
 * the "who has been emailed yet" bookkeeping stays in one place.
 *
 * Password rules (consistent with the rest of the app — see livestream-email):
 *  - A member who has ALREADY been emailed keeps their stored password forever
 *    (never rotated), so previously sent credentials keep working.
 *  - A member who has NEVER been emailed but whose stored password is a long
 *    machine token (the UUID that the webhook / sync script assigns) is given a
 *    fresh 6-letter password first. This is initial assignment, not a rotation:
 *    nothing was ever communicated, so nothing breaks, and the emailed password
 *    is typable.
 */

/** A UUID-shaped token: assigned by provisioning, never a human-typed password. */
const UUID_TOKEN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type DeliverableMember = {
  id: string
  name: string
  email: string
  password_token: string | null
  /** undefined = column not migrated yet; null = never sent; string = sent at. */
  credentials_sent_at?: string | null
}

export type DeliveryResult = {
  sent: boolean
  email: string
  password?: string
  resendId?: string
  error?: string
}

/**
 * Ensure `member` has a typable password, email their credentials, and stamp
 * `credentials_sent_at`. Returns a structured result instead of throwing so
 * callers (webhook, bulk loop) can keep going on a single failure.
 */
export async function deliverCredentials(
  member: DeliverableMember,
  opts: { client?: ReturnType<typeof createServiceClient> } = {}
): Promise<DeliveryResult> {
  const supabase = opts.client ?? createServiceClient()
  const neverSent = !member.credentials_sent_at

  // Reuse the stored password; only (re)assign for a member with no usable,
  // human-typable password who has never been emailed.
  let password = member.password_token || ''
  const needsPassword = !password || (neverSent && UUID_TOKEN.test(password))
  if (needsPassword) {
    password = makePassword()
    const { error } = await supabase
      .from('members')
      .update({ password_token: password })
      .eq('id', member.id)
    if (error) {
      return { sent: false, email: member.email, password, error: `DB update: ${error.message}` }
    }
  }

  const { subject, html, text } = renderCredentialsEmail({
    name: member.name,
    email: member.email,
    password,
    memberId: member.id,
  })

  let resendId: string
  try {
    resendId = await sendCredentialsEmail({ to: member.email, subject, html, text })
  } catch (e) {
    return {
      sent: false,
      email: member.email,
      password,
      error: e instanceof Error ? e.message : 'send failed',
    }
  }

  // Record the send. Best-effort: ignore the error if the column has not been
  // migrated yet (the email still went out, which is what matters).
  await supabase
    .from('members')
    .update({ credentials_sent_at: new Date().toISOString() })
    .eq('id', member.id)

  return { sent: true, email: member.email, password, resendId }
}
