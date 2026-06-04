import { NextRequest, NextResponse } from 'next/server'
import {
  verifyShopifyWebhook,
  isLivestreamOrder,
  provisionLivestreamMember,
  type ShopifyOrder,
} from '@/lib/shopify-webhook'

export const dynamic = 'force-dynamic'

/**
 * POST /api/webhooks/shopify/orders
 *
 * Receives Shopify order webhooks (orders/create, orders/paid). When the order
 * contains the livestream product, auto-provisions a vip_livestream member.
 * Idempotent and safe to receive multiple times for the same order.
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
    console.log('[shopify-webhook] livestream order', {
      topic,
      order: order.name,
      status: result.status,
    })
    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    console.error('[shopify-webhook] provisioning failed', e)
    return new NextResponse('server error', { status: 500 })
  }
}
