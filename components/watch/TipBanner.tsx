'use client'

import { X } from 'lucide-react'

interface TipBannerProps {
  name: string
  amount: number
  message?: string
  onClose: () => void
}

export default function TipBanner({ name, amount, message, onClose }: TipBannerProps) {
  return (
    <div className="tip-banner fixed top-4 left-1/2 -translate-x-1/2 z-50 max-w-md w-full mx-4">
      <div
        className="glass rounded-2xl px-5 py-4 border flex items-start gap-3 shadow-2xl"
        style={{ borderColor: 'oklch(0.68 0.22 350 / 0.3)' }}
      >
        <span className="text-2xl">💝</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">
            {amount > 0 ? (
              <>
                <span style={{ color: 'oklch(0.75 0.12 85)' }}>{name}</span>
                {' '}just tipped{' '}
                <span style={{ color: 'oklch(0.68 0.22 350)' }}>${(amount / 100).toFixed(0)}</span>!
              </>
            ) : (
              <>
                Thank you, <span style={{ color: 'oklch(0.75 0.12 85)' }}>{name}</span>!
              </>
            )}
          </p>
          {message && (
            <p className="text-xs text-muted-foreground mt-0.5 truncate">"{message}"</p>
          )}
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
