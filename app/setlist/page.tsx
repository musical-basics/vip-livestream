import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft, Music2, Clock3, KeyRound, ListChecks, CircleHelp } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { getSession } from '@/lib/auth'
import { isAdmin } from '@/lib/roles'
import { SETLIST_COLUMNS, type SetlistRow } from '@/lib/belgium-setlist'
import { getBelgiumTracker } from '@/lib/setlist-store'

export const metadata = {
  title: 'Belgium Concert Setlist',
}

function YesNoBadge({ value }: { value: string }) {
  const v = value.toLowerCase()
  if (v === 'yes') {
    return (
      <Badge className="border-[oklch(0.7_0.18_310/0.4)] bg-[oklch(0.7_0.18_310/0.12)] text-[oklch(0.82_0.14_310)]">
        Yes
      </Badge>
    )
  }
  if (v === 'no') {
    return <span className="text-muted-foreground/60">No</span>
  }
  return (
    <Badge variant="outline" className="border-[oklch(0.78_0.15_85/0.4)] text-[oklch(0.82_0.13_85)]">
      {value}
    </Badge>
  )
}

function SetlistTable({ rows }: { rows: SetlistRow[] }) {
  return (
    <div className="glass overflow-x-auto rounded-2xl">
      <table className="w-full min-w-[860px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-white/10 text-left">
            {SETLIST_COLUMNS.map((col) => (
              <th
                key={col}
                className="px-3 py-3 text-[10px] font-medium uppercase tracking-widest text-muted-foreground"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.num} className="border-b border-white/5 align-top last:border-0">
              <td className="px-3 py-3 font-mono text-xs text-[oklch(0.78_0.13_85)]">{row.num}</td>
              <td
                className="px-3 py-3 font-medium text-foreground"
                style={{ fontFamily: "'Cormorant Garamond', serif" }}
              >
                {row.piece}
              </td>
              <td className="px-3 py-3 text-foreground/80">{row.soloEnsemble}</td>
              <td className="px-3 py-3">
                <YesNoBadge value={row.edm} />
              </td>
              <td className="px-3 py-3 text-foreground/80">{row.runtime}</td>
              <td className="px-3 py-3 text-foreground/70">{row.clickToLuc}</td>
              <td className="px-3 py-3 text-muted-foreground/70">{row.lighting}</td>
              <td className="px-3 py-3 text-muted-foreground/70">{row.video}</td>
              <td className="px-3 py-3 text-sm text-muted-foreground">{row.notes}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function SectionTitle({
  icon,
  children,
}: {
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <span className="text-[oklch(0.75_0.12_85)]">{icon}</span>
      <h2
        className="text-xl font-light text-gold"
        style={{ fontFamily: "'Cormorant Garamond', serif" }}
      >
        {children}
      </h2>
    </div>
  )
}

export default async function SetlistPage() {
  // Internal production tracker (click tracks, lighting, open decisions), so
  // it is admin-only. Moderators (chat-only) and ordinary VIP viewers see the
  // polished programme on /watch instead.
  const member = await getSession()
  if (!member) redirect('/')
  if (!isAdmin(member)) redirect('/watch')

  const tracker = await getBelgiumTracker()
  const {
    header,
    mainProgram,
    mainMusicTotalMin,
    encores,
    benchHeading,
    bench,
    timing,
    colorKey,
    workflow,
    openDecisions,
  } = tracker

  return (
    <main className="min-h-[100dvh]">
      <header className="glass-heavy flex flex-wrap items-center gap-3 border-b border-border/50 px-4 py-4 sm:px-6">
        <Link
          href="/watch"
          className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Watch
        </Link>
        <div className="flex items-center gap-2">
          <Music2 className="h-4 w-4 text-[oklch(0.75_0.12_85)]" />
          <h1
            className="text-lg font-light text-gold"
            style={{ fontFamily: "'Cormorant Garamond', serif" }}
          >
            Belgium Concert Setlist
          </h1>
        </div>
      </header>

      <div className="mx-auto max-w-6xl space-y-10 px-4 py-6 sm:px-6">
        {/* Concert header */}
        <section>
          <p className="text-sm uppercase tracking-widest text-muted-foreground">
            {header.tracker}
          </p>
          <p className="mt-1 text-foreground/90">{header.when}</p>
          <p className="text-sm text-muted-foreground">{header.venue}</p>
        </section>

        {/* Main program */}
        <section>
          <SectionTitle icon={<Music2 className="h-4 w-4" />}>Main program</SectionTitle>
          <SetlistTable rows={mainProgram} />
          <p className="mt-2 text-xs text-muted-foreground">
            Music total, all listed (main): {mainMusicTotalMin} min.
          </p>
        </section>

        {/* Encores */}
        <section>
          <SectionTitle icon={<Music2 className="h-4 w-4" />}>Encores</SectionTitle>
          <SetlistTable rows={encores} />
        </section>

        {/* Bench / candidates */}
        <section>
          <SectionTitle icon={<Music2 className="h-4 w-4" />}>Bench / candidates</SectionTitle>
          <p className="mb-3 text-sm text-muted-foreground">{benchHeading}</p>
          <SetlistTable rows={bench} />
        </section>

        {/* Timing */}
        <section>
          <SectionTitle icon={<Clock3 className="h-4 w-4" />}>{timing.title}</SectionTitle>
          <p className="mb-3 text-sm text-muted-foreground">{timing.target}</p>
          <div className="glass overflow-x-auto rounded-2xl">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left">
                  {timing.columns.map((col) => (
                    <th
                      key={col}
                      className="px-3 py-3 text-[10px] font-medium uppercase tracking-widest text-muted-foreground"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {timing.rows.map((row) => (
                  <tr key={row.component} className="border-b border-white/5 align-top">
                    <td className="px-3 py-3 text-foreground/80">{row.component}</td>
                    <td className="px-3 py-3 text-foreground/80">{row.low}</td>
                    <td className="px-3 py-3 text-foreground/80">{row.high}</td>
                    <td className="px-3 py-3 text-sm text-muted-foreground">{row.notes}</td>
                  </tr>
                ))}
                <tr className="border-b border-white/10 bg-white/3 align-top font-medium">
                  <td className="px-3 py-3 text-foreground">{timing.mainTotal.component}</td>
                  <td className="px-3 py-3 text-foreground">{timing.mainTotal.low}</td>
                  <td className="px-3 py-3 text-foreground">{timing.mainTotal.high}</td>
                  <td className="px-3 py-3 text-sm text-muted-foreground">{timing.mainTotal.notes}</td>
                </tr>
                {timing.encoreRows.map((row) => (
                  <tr key={row.component} className="border-b border-white/5 align-top">
                    <td className="px-3 py-3 text-foreground/80">{row.component}</td>
                    <td className="px-3 py-3 text-foreground/80">{row.low}</td>
                    <td className="px-3 py-3 text-foreground/80">{row.high}</td>
                    <td className="px-3 py-3 text-sm text-muted-foreground">{row.notes}</td>
                  </tr>
                ))}
                <tr className="align-top font-medium">
                  <td className="px-3 py-3 text-[oklch(0.82_0.14_45)]">{timing.fullTotal.component}</td>
                  <td className="px-3 py-3 text-[oklch(0.82_0.14_45)]">{timing.fullTotal.low}</td>
                  <td className="px-3 py-3 text-[oklch(0.82_0.14_45)]">{timing.fullTotal.high}</td>
                  <td className="px-3 py-3 text-sm text-[oklch(0.82_0.14_45)]">
                    {timing.fullTotal.notes}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="glass mt-4 rounded-2xl p-4">
            <p className="mb-2 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
              Verdict
            </p>
            <ul className="space-y-1.5 text-sm text-muted-foreground">
              {timing.verdict.map((line) => (
                <li key={line} className="flex gap-2">
                  <span className="text-[oklch(0.75_0.12_85)]">-</span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Color key */}
        <section>
          <SectionTitle icon={<KeyRound className="h-4 w-4" />}>Color key</SectionTitle>
          <div className="glass grid gap-3 rounded-2xl p-4 sm:grid-cols-2">
            {colorKey.map((item) => (
              <div key={item.key} className="text-sm">
                <span className="font-medium text-foreground">{item.key}: </span>
                <span className="text-muted-foreground">{item.meaning}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Workflow */}
        <section>
          <SectionTitle icon={<ListChecks className="h-4 w-4" />}>Workflow</SectionTitle>
          <ol className="glass space-y-3 rounded-2xl p-4">
            {workflow.map((item) => (
              <li key={item.step} className="flex gap-3 text-sm">
                <span className="shrink-0 font-mono text-xs text-[oklch(0.78_0.13_85)]">
                  {item.step}
                </span>
                <span className="text-muted-foreground">{item.detail}</span>
              </li>
            ))}
          </ol>
        </section>

        {/* Open decisions */}
        <section>
          <SectionTitle icon={<CircleHelp className="h-4 w-4" />}>Open decisions</SectionTitle>
          <div className="glass space-y-3 rounded-2xl p-4">
            {openDecisions.map((item) => (
              <div key={item.topic} className="text-sm">
                <p className="font-medium text-foreground">{item.topic}</p>
                <p className="text-muted-foreground">{item.detail}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}
