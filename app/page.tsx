import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import LoginForm from '@/components/LoginForm'

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; pw?: string }>
}) {
  // Already logged in
  const session = await getSession()
  if (session) {
    redirect('/watch')
  }

  // Direct-link credentials (e.g. from the invitation email): ?email=...&pw=...
  const { email, pw } = await searchParams

  return (
    <main className="flex min-h-[100dvh] items-center justify-center px-4 py-6 sm:p-4">
      {/* Background piano keys subtle illustration */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-32 opacity-5">
          {Array.from({ length: 24 }).map((_, i) => (
            <div
              key={i}
              className="inline-block h-full border-r border-white/20"
              style={{
                width: `${100 / 24}%`,
                background: [1, 3, 6, 8, 10, 13, 15, 18, 20, 22].includes(i % 12)
                  ? 'oklch(0.15 0.01 270)'
                  : 'oklch(0.5 0.01 270)',
              }}
            />
          ))}
        </div>
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo / branding */}
        <div className="mb-8 text-center sm:mb-10">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[oklch(0.75_0.12_85)] to-[oklch(0.55_0.10_70)] flex items-center justify-center">
              <span className="text-sm">🎹</span>
            </div>
            <span className="text-sm font-medium tracking-widest uppercase text-muted-foreground">
              Musical Basics
            </span>
          </div>
          <h1
            className="mb-3 text-4xl font-light text-gold sm:text-5xl"
            style={{ fontFamily: "'Cormorant Garamond', serif" }}
          >
            VIP Livestream
          </h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            An intimate piano performance, exclusively for you.
            <br />
            Enter your invitation email and assigned password below.
          </p>
        </div>

        {/* Login card */}
        <div className="glass rounded-2xl p-6 shadow-2xl sm:p-8">
          <LoginForm defaultEmail={email ?? ''} defaultPassword={pw ?? ''} />
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground mt-6 opacity-50">
          Access is by invitation only. If you need help, contact your host.
        </p>
      </div>
    </main>
  )
}
