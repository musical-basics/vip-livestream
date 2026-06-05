'use client'

import { useState, useTransition, useEffect, useRef } from 'react'
import { loginAction } from '@/app/actions'
import { Button } from '@/components/ui/button'
import { Loader2, KeyRound, AlertCircle, Mail, ArrowRight } from 'lucide-react'

interface LoginFormProps {
  defaultEmail?: string
  defaultPassword?: string
}

export default function LoginForm({ defaultEmail = '', defaultPassword = '' }: LoginFormProps) {
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const autoSubmitted = useRef(false)

  function submit(formData: FormData) {
    setError(null)
    startTransition(async () => {
      const result = await loginAction(formData)
      if (result?.error) {
        setError(result.error)
      }
    })
  }

  async function handleSubmit(formData: FormData) {
    submit(formData)
  }

  // Direct-link login: when the URL supplies both email and password, log in
  // automatically (like a Zoom join link). The fields stay pre-filled so the
  // member can retry manually if auto-login fails.
  useEffect(() => {
    if (autoSubmitted.current) return
    if (defaultEmail && defaultPassword) {
      autoSubmitted.current = true
      const fd = new FormData()
      fd.set('email', defaultEmail)
      fd.set('password', defaultPassword)
      submit(fd)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <form action={handleSubmit} className="space-y-5">
      <div>
        <label
          htmlFor="email"
          className="block text-xs font-medium tracking-widest uppercase text-muted-foreground mb-2"
        >
          Email Address
        </label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            id="email"
            name="email"
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
            defaultValue={defaultEmail}
            disabled={isPending}
            className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/5 border border-white/10 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-[oklch(0.75_0.12_85)] focus:ring-1 focus:ring-[oklch(0.75_0.12_85)] transition-colors text-sm"
          />
        </div>
      </div>

      <div>
        <label
          htmlFor="password"
          className="block text-xs font-medium tracking-widest uppercase text-muted-foreground mb-2"
        >
          Access Password
        </label>
        <div className="relative">
          <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            id="password"
            name="password"
            type="password"
            placeholder="Enter your assigned password"
            autoComplete="current-password"
            defaultValue={defaultPassword}
            disabled={isPending}
            className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/5 border border-white/10 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-[oklch(0.75_0.12_85)] focus:ring-1 focus:ring-[oklch(0.75_0.12_85)] transition-colors text-sm"
          />
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <Button
        type="submit"
        disabled={isPending}
        className="h-12 w-full rounded-xl font-medium tracking-wide text-sm transition-all duration-200"
        style={{
          background: 'linear-gradient(135deg, oklch(0.78 0.13 85), oklch(0.62 0.10 70))',
          color: 'oklch(0.09 0.015 270)',
        }}
      >
        {isPending ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Entering…
          </>
        ) : (
          <>
            Enter VIP Livestream
            <ArrowRight className="w-4 h-4 ml-2" />
          </>
        )}
      </Button>
    </form>
  )
}
