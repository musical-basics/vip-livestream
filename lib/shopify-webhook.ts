import { createHmac, timingSafeEqual, randomUUID } from 'node:crypto'
import { createServiceClient } from '@/lib/supabase-server'

/**
 * The Belgium Concert Livestream product variant (see the belgium-concert repo
 * src/lib/checkout.ts). Only orders containing this variant provision a member.
 */
export const LIVESTREAM_VARIANT_ID = '43999228330027'

/**
 * Verify a Shopify webhook HMAC. Webhooks registered via the Admin API are
 * signed with the app's client secret — that value lives in SHOPIFY_WEBHOOK_SECRET.
 */
export function verifyShopifyWebhook(rawBody: string, hmacHeader: string | null): boolean {
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET
  if (!secret || !hmacHeader) return false

  const computed = createHmac('sha256', secret).update(rawBody, 'utf8').digest('base64')
  const a = Buffer.from(computed)
  const b = Buffer.from(hmacHeader)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
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
  | { status: 'created'; email: string; password_token: string }
  | { status: 'exists'; email: string; password_token: string }
  | { status: 'skipped'; reason: string }

/**
 * Idempotently provision a member from a livestream order. If a member with the
 * same email already exists, their password_token is preserved (so any invite
 * link already sent keeps working) — we never regenerate on a webhook re-fire.
 */
export async function provisionLivestreamMember(order: ShopifyOrder): Promise<ProvisionResult> {
  const c = order.customer ?? {}
  const email = (c.email ?? order.email ?? '').trim().toLowerCase()
  if (!email) return { status: 'skipped', reason: 'no_email' }

  const name = `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim() || email.split('@')[0]
  const supabase = createServiceClient()

  const { data: existing, error: selErr } = await supabase
    .from('members')
    .select('email,password_token')
    .eq('email', email)
    .maybeSingle()
  if (selErr) throw new Error(`member lookup failed: ${selErr.message}`)

  if (existing) {
    return { status: 'exists', email, password_token: existing.password_token }
  }

  const password_token = randomUUID()
  const { data, error } = await supabase
    .from('members')
    .insert({ name, email, password_token, display_name: name, is_moderator: false })
    .select('email,password_token')
    .single()
  if (error) {
    // Lost an insert race (unique email) — treat as already provisioned.
    if (error.code === '23505') {
      const { data: row } = await supabase
        .from('members')
        .select('email,password_token')
        .eq('email', email)
        .single()
      if (row) return { status: 'exists', email, password_token: row.password_token }
    }
    throw new Error(`member insert failed: ${error.message}`)
  }

  return { status: 'created', email, password_token: data.password_token }
}
