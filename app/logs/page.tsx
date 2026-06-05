import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft, ScrollText, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { getSession } from '@/lib/auth'
import { isAdmin } from '@/lib/roles'
import { getRecentLoginEvents, type LoginEventRow } from '@/lib/tracking'

export const metadata = { title: 'Login Logs' }

const REASON_LABEL: Record<string, string> = {
  ok: 'OK',
  bad_password: 'Wrong password',
  no_member: 'Unknown email',
  banned: 'Banned',
}

function fmt(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(value))
}

export default async function LogsPage() {
  const member = await getSession()
  if (!member) redirect('/')
  if (!isAdmin(member)) redirect('/watch')

  const events = await getRecentLoginEvents(400)

  const successes = events.filter((e) => e.success).length
  const failures = events.length - successes

  // Emails that have failed and never succeeded in this window = people stuck out.
  const byEmail = new Map<string, { fails: number; ok: number; lastFailReason: string | null; last: string }>()
  for (const e of events) {
    const key = e.email.toLowerCase()
    const cur = byEmail.get(key) ?? { fails: 0, ok: 0, lastFailReason: null, last: e.created_at }
    if (e.success) cur.ok += 1
    else {
      cur.fails += 1
      if (!cur.lastFailReason) cur.lastFailReason = e.reason
    }
    byEmail.set(key, cur)
  }
  const stuck = [...byEmail.entries()]
    .filter(([, v]) => v.fails > 0 && v.ok === 0)
    .sort((a, b) => b[1].fails - a[1].fails)

  return (
    <main className="min-h-[100dvh]">
      <header className="glass-heavy flex flex-wrap items-center gap-3 border-b border-border/50 px-4 py-4 sm:px-6">
        <Link href="/admin" className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          Back to Admin
        </Link>
        <div className="flex items-center gap-2">
          <ScrollText className="h-4 w-4 text-[oklch(0.75_0.12_85)]" />
          <h1 className="text-lg font-light text-gold" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
            Login Logs
          </h1>
        </div>
        <Link href="/analytics" className="ml-auto text-sm text-muted-foreground transition-colors hover:text-foreground">
          Analytics &rarr;
        </Link>
      </header>

      <div className="mx-auto max-w-5xl space-y-8 px-4 py-6 sm:px-6">
        {/* Summary */}
        <div className="grid grid-cols-3 gap-3">
          <div className="glass rounded-2xl p-4">
            <p className="text-2xl font-light text-foreground">{events.length}</p>
            <p className="text-xs text-muted-foreground">Attempts (recent)</p>
          </div>
          <div className="glass rounded-2xl p-4">
            <p className="text-2xl font-light text-[oklch(0.8_0.15_150)]">{successes}</p>
            <p className="text-xs text-muted-foreground">Successful</p>
          </div>
          <div className="glass rounded-2xl p-4">
            <p className="text-2xl font-light text-[oklch(0.7_0.2_25)]">{failures}</p>
            <p className="text-xs text-muted-foreground">Failed</p>
          </div>
        </div>

        {events.length === 0 && (
          <div className="glass rounded-2xl p-8 text-center">
            <ScrollText className="mx-auto mb-3 h-8 w-8 text-muted-foreground opacity-40" />
            <p className="text-sm text-muted-foreground">
              No login events yet. (If you expected some, run supabase/migrate-tracking.sql.)
            </p>
          </div>
        )}

        {/* Trouble signing in */}
        {stuck.length > 0 && (
          <section>
            <div className="mb-3 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-[oklch(0.78_0.15_85)]" />
              <h2 className="text-base font-medium text-foreground">Trouble signing in</h2>
              <span className="text-xs text-muted-foreground">(failed, never succeeded)</span>
            </div>
            <div className="glass overflow-hidden rounded-2xl divide-y divide-white/5">
              {stuck.map(([email, v]) => (
                <div key={email} className="flex items-center justify-between gap-3 px-4 py-3">
                  <span className="truncate text-sm text-foreground">{email}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="outline" className="border-[oklch(0.7_0.2_25)/40] text-[oklch(0.78_0.16_25)] text-[10px]">
                      {v.fails} fail{v.fails > 1 ? 's' : ''}
                    </Badge>
                    {v.lastFailReason && (
                      <span className="text-xs text-muted-foreground">{REASON_LABEL[v.lastFailReason] ?? v.lastFailReason}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Event stream */}
        {events.length > 0 && (
          <section>
            <h2 className="mb-3 text-base font-medium text-foreground">Recent attempts</h2>
            <div className="glass overflow-x-auto rounded-2xl">
              <table className="w-full min-w-[560px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-left">
                    <th className="px-3 py-3 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">When</th>
                    <th className="px-3 py-3 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Email</th>
                    <th className="px-3 py-3 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Result</th>
                    <th className="px-3 py-3 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((e: LoginEventRow) => (
                    <tr key={e.id} className="border-b border-white/5 last:border-0">
                      <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">{fmt(e.created_at)}</td>
                      <td className="px-3 py-2.5 text-foreground/90">{e.email}</td>
                      <td className="px-3 py-2.5">
                        {e.success ? (
                          <span className="inline-flex items-center gap-1 text-[oklch(0.8_0.15_150)]">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Success
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[oklch(0.75_0.18_25)]">
                            <XCircle className="h-3.5 w-3.5" /> Failed
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground">{e.reason ? (REASON_LABEL[e.reason] ?? e.reason) : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </main>
  )
}
