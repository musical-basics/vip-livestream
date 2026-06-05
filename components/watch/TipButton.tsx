'use client'

import { useState } from 'react'
import type { Stream, Member } from '@/lib/database.types'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Heart, Loader2 } from 'lucide-react'

interface TipButtonProps {
  member: Member
  stream: Stream | null
}

const TIP_AMOUNTS = [
  { label: '$5', cents: 500 },
  { label: '$10', cents: 1000 },
  { label: '$25', cents: 2500 },
  { label: '$50', cents: 5000 },
]

export default function TipButton({ member, stream }: TipButtonProps) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<number | null>(null)
  const [custom, setCustom] = useState('')
  const [message, setMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const amountCents = selected ?? (custom ? Math.round(parseFloat(custom) * 100) : null)

  async function handleTip() {
    if (!amountCents || amountCents < 100) {
      setError('Minimum tip is $1')
      return
    }
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount_cents: amountCents,
          message: message.trim() || null,
          stream_id: stream?.id,
        }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        setError('Unable to start payment. Please try again.')
      }
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium sm:w-auto"
        style={{
          background: 'linear-gradient(135deg, oklch(0.68 0.22 350), oklch(0.55 0.18 320))',
          color: 'white',
        }}
      >
        <Heart className="w-4 h-4" />
        Support the Artist
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="glass border-white/10 max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle
              className="text-2xl font-light text-gold text-center"
              style={{ fontFamily: "'Cormorant Garamond', serif" }}
            >
              Support the Artist
            </DialogTitle>
            <DialogDescription className="text-center text-muted-foreground text-sm">
              Show your appreciation with a tip. 100% goes to the performer.
            </DialogDescription>
          </DialogHeader>

          {/* Amount selector */}
          <div className="grid grid-cols-4 gap-2 mt-2">
            {TIP_AMOUNTS.map(({ label, cents }) => (
              <button
                key={cents}
                onClick={() => { setSelected(cents); setCustom('') }}
                className={`py-2.5 rounded-xl text-sm font-medium border transition-all ${
                  selected === cents
                    ? 'border-[oklch(0.75_0.12_85)] bg-[oklch(0.75_0.12_85)/15] text-[oklch(0.75_0.12_85)]'
                    : 'border-white/10 bg-white/5 text-muted-foreground hover:border-white/20 hover:text-foreground'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Custom amount */}
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
            <input
              value={custom}
              onChange={(e) => { setCustom(e.target.value); setSelected(null) }}
              placeholder="Custom amount"
              type="number"
              min="1"
              className="w-full pl-7 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-[oklch(0.75_0.12_85)] focus:ring-1 focus:ring-[oklch(0.75_0.12_85)] transition-colors"
            />
          </div>

          {/* Message */}
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Leave a message (optional)"
            maxLength={200}
            rows={2}
            className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm resize-none focus:outline-none focus:border-[oklch(0.75_0.12_85)] focus:ring-1 focus:ring-[oklch(0.75_0.12_85)] transition-colors placeholder:text-muted-foreground/50"
          />

          {error && (
            <p className="text-xs text-destructive text-center">{error}</p>
          )}

          <Button
            onClick={handleTip}
            disabled={isLoading || !amountCents}
            className="w-full rounded-xl py-3 font-medium"
            style={{
              background: amountCents
                ? 'linear-gradient(135deg, oklch(0.68 0.22 350), oklch(0.55 0.18 320))'
                : undefined,
              color: amountCents ? 'white' : undefined,
            }}
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Heart className="w-4 h-4 mr-2" />
                {amountCents ? `Tip ${amountCents >= 100 ? `$${(amountCents / 100).toFixed(amountCents % 100 === 0 ? 0 : 2)}` : ''}` : 'Select an amount'}
              </>
            )}
          </Button>
        </DialogContent>
      </Dialog>
    </>
  )
}
