import { createHmac, timingSafeEqual } from 'node:crypto'
import { createServiceClient } from '@/lib/supabase-server'
import { makePassword } from '@/lib/livestream-email'
import type { DeliverableMember } from '@/lib/credential-delivery'

/**
 * The Belgium Concert Livestream product variant (see the belgium-concert repo
 * src/lib/checkout.ts). Only orders containing this variant provision a member.
 */
export const LIVESTREAM_VARIANT_ID = '43999228330027'

/**
 * Verify a Shopify webhook HMAC.
 *
 * Depending on how a webhook was created, Shopify signs it with either the
 * store's webhook signing secret (SHOPIFY_WEBHOOK_SECRET) or the app's client
 * secret (SHOPIFY_CLIENT_SECRET). We accept a match against any configured
 * candidate — every candidate is still a full HMAC check, so this widens which
 * secret works without weakening verification.
 */
export function verifyShopifyWebhook(rawBody: string, hmacHeader: string | null): boolean {
  if (!hmacHeader) return false

  const candidates = [
    process.env.SHOPIFY_WEBHOOK_SECRET,
    process.env.SHOPIFY_CLIENT_SECRET,
    process.env.SHOPIFY_API_SECRET,
  ].filter((s): s is string => Boolean(s))
  if (candidates.length === 0) return false

  const provided = Buffer.from(hmacHeader)
  return candidates.some((secret) => {
    const computed = Buffer.from(
      createHmac('sha256', secret).update(rawBody, 'utf8').digest('base64')
    )
    return computed.length === provided.length && timingSafeEqual(computed, provided)
  })
}

type ShopifyLineItem = { variant_id?: number | string | null }
type ShopifyCustomer = { email?: string | null; first_name?: string | null; last_name?: string | null }
export type ShopifyOrder = {
  id?: number | string
  name?: string | null
  email?: string | null
  customer?: ShopifyCustomer | null
  line_items?: ShopifyLineItem[] | null
  financial_status?: string | null
  cancelled_at?: string | null
}

/** True if the order contains the livestream variant and is not cancelled. */
export function isLivestreamOrder(order: ShopifyOrder): boolean {
  if (order.cancelled_at) return false
  return (order.line_items ?? []).some(
    (li) => String(li.variant_id) === LIVESTREAM_VARIANT_ID
  )
}

export type ProvisionResult =
  | { status: 'created'; member: DeliverableMember }
  | { status: 'exists'; member: DeliverableMember }
  | { status: 'skipped'; reason: string }

function isMissingAccessBadgesColumn(error: { code?: string; message?: string }) {
  return error.code === 'PGRST204' || error.message?.includes('access_badges')
}

/** Columns needed to decide whether to email + how. `select('*')` so this works
 * whether or not credentials_sent_at has been migrated yet. */
function toDeliverable(row: Record<string, unknown>): DeliverableMember {
  return {
    id: String(row.id),
    name: String(row.name ?? ''),
    email: String(row.email ?? ''),
    password_token: (row.password_token as string | null) ?? null,
    credentials_sent_at: (row.credentials_sent_at as string | null | undefined),
  }
}

/**
 * Idempotently provision a member from a livestream order. If a member with the
 * same email already exists, their assigned password is preserved, so already
 * emailed credentials keep working. We never regenerate on a webhook re-fire.
 *
 * A brand-new member is given a typable 6-letter password so the credential
 * email (sent by the route) shows something a human can enter by hand.
 */
export async function provisionLivestreamMember(order: ShopifyOrder): Promise<ProvisionResult> {
  const c = order.customer ?? {}
  const email = (c.email ?? order.email ?? '').trim().toLowerCase()
  if (!email) return { status: 'skipped', reason: 'no_email' }

  const name = `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim() || email.split('@')[0]
  const supabase = createServiceClient()

  const { data: existing, error: selErr } = await supabase
    .from('members')
    .select('*')
    .eq('email', email)
    .maybeSingle()
  if (selErr) throw new Error(`member lookup failed: ${selErr.message}`)

  if (existing) {
    return { status: 'exists', member: toDeliverable(existing) }
  }

  const insertPayload = {
    name,
    email,
    password_token: makePassword(),
    access_badges: ['dreamplay_buyer'],
    display_name: name,
    is_moderator: false,
    is_admin: false,
  }
  let { data, error } = await supabase
    .from('members')
    .insert(insertPayload)
    .select('*')
    .single()
  if (error && isMissingAccessBadgesColumn(error)) {
    const { access_badges: _accessBadges, ...legacyPayload } = insertPayload
    const retry = await supabase
      .from('members')
      .insert(legacyPayload)
      .select('*')
      .single()
    data = retry.data
    error = retry.error
  }
  if (error) {
    // Lost an insert race (unique email) — treat as already provisioned.
    if (error.code === '23505') {
      const { data: row } = await supabase
        .from('members')
        .select('*')
        .eq('email', email)
        .single()
      if (row) return { status: 'exists', member: toDeliverable(row) }
    }
    throw new Error(`member insert failed: ${error.message}`)
  }

  return { status: 'created', member: toDeliverable(data) }
}
