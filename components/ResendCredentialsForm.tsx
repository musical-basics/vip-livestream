'use client'

import { useState, useTransition, type FormEvent } from 'react'
import { Mail, Loader2, RotateCcw, CheckCircle2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

type Result = { ok: boolean; message: string } | null

/**
 * Public "resend my access" form for the login page. A buyer who lost or never
 * received their invitation enters the email they purchased with and we re-send
 * the credential email via POST /api/request-credentials. Collapsed by default
 * so it stays out of the way of the normal login flow.
 */
export default function ResendCredentialsForm() {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [company, setCompany] = useState('') // honeypot — must stay empty
  const [result, setResult] = useState<Result>(null)
  const [isPending, startTransition] = useTransition()

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    setResult(null)
    startTransition(async () => {
      try {
        const res = await fetch('/api/request-credentials', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, company }),
        })
        const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string }
        setResult({
          ok: !!data.ok,
          message:
            data.message ||
            (data.ok ? 'Sent — check your inbox.' : 'Something went wrong. Please try again.'),
        })
      } catch {
        setResult({ ok: false, message: 'Network error — please try again.' })
      }
    })
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-6 flex w-full items-center justify-center gap-1.5 text-center text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        <RotateCcw className="h-3.5 w-3.5" />
        Didn&rsquo;t get your access email? Resend it
      </button>
    )
  }

  return (
    <div className="glass mt-6 rounded-2xl p-5 sm:p-6">
      <div className="mb-3 flex items-start gap-2">
        <RotateCcw className="mt-0.5 h-4 w-4 shrink-0 text-[oklch(0.75_0.12_85)]" />
        <div>
          <p className="text-sm font-medium text-foreground">Resend your access</p>
          <p className="text-xs text-muted-foreground">
            Enter the email you bought the livestream with and we&rsquo;ll re-send your login link and
            password.
          </p>
        </div>
      </div>

      <form onSubmit={onSubmit} className="space-y-3">
        {/* Honeypot: hidden from humans, catches bots. Must stay empty. */}
        <input
          type="text"
          name="company"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          className="absolute left-[-9999px] h-0 w-0 opacity-0"
        />
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="email"
            name="purchase_email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email used at checkout"
            autoComplete="email"
            disabled={isPending}
            className="w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground/50 transition-colors focus:border-[oklch(0.75_0.12_85)] focus:outline-none focus:ring-1 focus:ring-[oklch(0.75_0.12_85)]"
          />
        </div>

        {result && (
          <div
            className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${
              result.ok
                ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
                : 'border-amber-500/20 bg-amber-500/10 text-amber-200'
            }`}
          >
            {result.ok ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            ) : (
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            )}
            <span>{result.message}</span>
          </div>
        )}

        <Button
          type="submit"
          disabled={isPending}
          className="h-11 w-full rounded-xl text-sm font-medium"
          style={{
            background: 'linear-gradient(135deg, oklch(0.78 0.13 85), oklch(0.62 0.10 70))',
            color: 'oklch(0.09 0.015 270)',
          }}
        >
          {isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Sending…
            </>
          ) : (
            'Resend my access'
          )}
        </Button>
      </form>
    </div>
  )
}
