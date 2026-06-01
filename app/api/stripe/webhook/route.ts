import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createServiceClient } from '@/lib/supabase-server'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export async function POST(request: NextRequest) {
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')!

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err) {
    console.error('Stripe webhook signature error:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const { member_id, stream_id, message, amount_cents } = session.metadata || {}

    if (member_id && stream_id) {
      const supabase = createServiceClient()
      await supabase.from('tips').insert({
        member_id,
        stream_id,
        amount_cents: parseInt(amount_cents || '0'),
        stripe_session_id: session.id,
        message: message || null,
      })
    }
  }

  return NextResponse.json({ received: true })
}
