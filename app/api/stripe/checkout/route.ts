import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getSession } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase-server'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { amount_cents, message, stream_id } = await request.json()

  if (!amount_cents || amount_cents < 100) {
    return NextResponse.json({ error: 'Minimum tip is $1' }, { status: 400 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://vip.musicalbasics.com'

  const checkoutSession = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: '💝 Support the Artist',
            description: message || 'A tip for the performer — thank you!',
          },
          unit_amount: amount_cents,
        },
        quantity: 1,
      },
    ],
    mode: 'payment',
    success_url: `${appUrl}/watch?tip_success=1`,
    cancel_url: `${appUrl}/watch`,
    metadata: {
      member_id: session.id,
      member_name: session.display_name || session.name,
      stream_id: stream_id || '',
      message: message || '',
      amount_cents: String(amount_cents),
    },
  })

  return NextResponse.json({ url: checkoutSession.url })
}
