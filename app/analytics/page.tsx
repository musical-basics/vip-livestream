import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft, BarChart3, CheckCircle2, MinusCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { getSession } from '@/lib/auth'
import { isAdmin } from '@/lib/roles'
import { getMemberParticipation } from '@/lib/tracking'

export const metadata = { title: 'Analytics' }

function pct(n: number, d: number) {
  if (!d) return '0%'
  return `${Math.round((n / d) * 100)}%`
}

function fmt(value: string | null) {
  if (!value) return '-'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="glass rounded-2xl p-4">
      <p className="text-2xl font-light text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
      {sub && <p className="mt-0.5 text-[11px] text-muted-foreground/70">{sub}</p>}
    </div>
  )
}

export default async function AnalyticsPage() {
  const member = await getSession()
  if (!member) redirect('/')
  if (!isAdmin(member)) redirect('/watch')

  const rows = await getMemberParticipation()

  const total = rows.length
  const opened = rows.filter((r) => r.emailOpens > 0).length
  const loggedIn = rows.filter((r) => r.loginSuccesses > 0).length
  const participated = rows.filter((r) => r.participated).length
  const totalMessages = rows.reduce((s, r) => s + r.messages, 0)

  // Most engaged first: participated, then by messages, then logins.
  const sorted = [...rows].sort(
    (a, b) =>
      Number(b.participated) - Number(a.participated) ||
      b.messages - a.messages ||
      b.loginSuccesses - a.loginSuccesses ||
      a.name.localeCompare(b.name)
  )

  return (
    <main className="min-h-[100dvh]">
      <header className="glass-heavy flex flex-wrap items-center gap-3 border-b border-border/50 px-4 py-4 sm:px-6">
        <Link href="/admin" className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          Back to Admin
        </Link>
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-[oklch(0.75_0.12_85)]" />
          <h1 className="text-lg font-light text-gold" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
            Analytics
          </h1>
        </div>
        <Link href="/logs" className="ml-auto text-sm text-muted-foreground transition-colors hover:text-foreground">
          Login Logs &rarr;
        </Link>
      </header>

      <div className="mx-auto max-w-6xl space-y-8 px-4 py-6 sm:px-6">
        {/* Overview */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Registered members" value={String(total)} />
          <Stat label="Opened email" value={pct(opened, total)} sub={`${opened} / ${total}`} />
          <Stat label="Logged in" value={pct(loggedIn, total)} sub={`${loggedIn} / ${total}`} />
          <Stat label="Participated" value={pct(participated, total)} sub={`${participated} / ${total} (login or chat)`} />
        </div>
        <p className="text-xs text-muted-foreground">
          {totalMessages} chat message{totalMessages === 1 ? '' : 's'} sent across all members.
          {total === 0 && ' (No data yet — run supabase/migrate-tracking.sql and send the credential emails.)'}
        </p>

        {/* Per-member */}
        <section>
          <h2 className="mb-3 text-base font-medium text-foreground">Per-member participation</h2>
          <div className="glass overflow-x-auto rounded-2xl">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left">
                  {['Member', 'Email opened', 'Logins', 'Last login', 'Failed', 'Messages', 'Participated'].map((h) => (
                    <th key={h} className="px-3 py-3 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map((r) => (
                  <tr key={r.id} className="border-b border-white/5 align-top last:border-0">
                    <td className="px-3 py-2.5">
                      <div className="text-foreground">{r.name}</div>
                      <div className="text-xs text-muted-foreground">{r.email}{r.is_banned ? ' (banned)' : ''}</div>
                    </td>
                    <td className="px-3 py-2.5">
                      {r.emailOpens > 0 ? (
                        <span className="text-foreground/80">Yes <span className="text-muted-foreground">({r.emailOpens})</span></span>
                      ) : (
                        <span className="text-muted-foreground/60">No</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-foreground/80">{r.loginSuccesses}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">{fmt(r.lastLoginAt)}</td>
                    <td className="px-3 py-2.5">
                      {r.loginFailures > 0
                        ? <span className="text-[oklch(0.75_0.18_25)]">{r.loginFailures}</span>
                        : <span className="text-muted-foreground/60">0</span>}
                    </td>
                    <td className="px-3 py-2.5 text-foreground/80">{r.messages}</td>
                    <td className="px-3 py-2.5">
                      {r.participated ? (
                        <Badge variant="outline" className="border-[oklch(0.75_0.15_150)/40] text-[oklch(0.82_0.13_150)] text-[10px]">
                          <CheckCircle2 className="mr-1 h-3 w-3" /> Yes
                        </Badge>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground/60">
                          <MinusCircle className="h-3 w-3" /> No
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  )
}
