import { NextRequest, NextResponse } from 'next/server'
import {
  verifyShopifyWebhook,
  isLivestreamOrder,
  provisionLivestreamMember,
  type ShopifyOrder,
} from '@/lib/shopify-webhook'
import { deliverCredentials } from '@/lib/credential-delivery'

export const dynamic = 'force-dynamic'

/**
 * POST /api/webhooks/shopify/orders
 *
 * Receives Shopify order webhooks (orders/create, orders/paid). When the order
 * contains the livestream product, auto-provisions a vip_livestream member AND
 * emails them their login credentials.
 *
 * Idempotent and safe to receive multiple times for the same order: the
 * credential email is only sent to a member who has not been emailed yet
 * (credentials_sent_at is null for a brand-new member, or for an existing one
 * the webhook/sync created but never emailed). Re-fires for already-emailed
 * members are a no-op, so nobody is spammed.
 */
export async function POST(request: NextRequest) {
  const raw = await request.text()
  const hmac = request.headers.get('x-shopify-hmac-sha256')
  const topic = request.headers.get('x-shopify-topic') || 'unknown'

  if (!verifyShopifyWebhook(raw, hmac)) {
    console.warn('[shopify-webhook] signature failed', { topic, hasHmac: Boolean(hmac) })
    return new NextResponse('invalid signature', { status: 401 })
  }

  let order: ShopifyOrder
  try {
    order = JSON.parse(raw)
  } catch {
    return new NextResponse('invalid json', { status: 400 })
  }

  // Acknowledge non-livestream orders so Shopify stops retrying.
  if (!isLivestreamOrder(order)) {
    return NextResponse.json({ ok: true, skipped: 'not_livestream' })
  }

  try {
    const result = await provisionLivestreamMember(order)

    if (result.status === 'skipped') {
      console.log('[shopify-webhook] livestream order skipped', { topic, order: order.name, reason: result.reason })
      return NextResponse.json({ ok: true, status: result.status, reason: result.reason })
    }

    const { member } = result
    // Email only if never sent. `undefined` means the credentials_sent_at column
    // is not migrated yet — in that pre-migration state only brand-new members
    // are emailed (status 'created'), so existing members are never re-spammed.
    const neverEmailed =
      result.status === 'created' || member.credentials_sent_at === null

    let emailed = false
    let emailError: string | undefined
    if (neverEmailed) {
      const delivery = await deliverCredentials(member)
      emailed = delivery.sent
      emailError = delivery.error
      if (!delivery.sent) {
        console.error('[shopify-webhook] credential email failed', { email: member.email, error: delivery.error })
      }
    }

    console.log('[shopify-webhook] livestream order', {
      topic,
      order: order.name,
      status: result.status,
      email: member.email,
      emailed,
    })
    return NextResponse.json({
      ok: true,
      status: result.status,
      email: member.email,
      emailed,
      ...(emailError && { email_error: emailError }),
    })
  } catch (e) {
    console.error('[shopify-webhook] provisioning failed', e)
    return new NextResponse('server error', { status: 500 })
  }
}
