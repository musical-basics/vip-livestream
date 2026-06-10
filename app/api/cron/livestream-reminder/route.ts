import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { sendEmail } from '@/lib/livestream-email'
import { renderReminderEmail, type ReminderWindow } from '@/lib/reminder-email'
import { concertStart } from '@/lib/concert'

// Sending to the whole guest list one-at-a-time (Resend rate limits) can take a
// while, so allow the function to run long.
export const maxDuration = 300
export const dynamic = 'force-dynamic'

const WINDOWS: ReminderWindow[] = ['24h', '12h', '3h']
const SEND_DELAY_MS = 300 // ~3 sends/sec, under Resend's default limit

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** When no ?window is given, infer it from how far out the concert is. */
function inferWindow(now: Date): ReminderWindow | null {
  const hoursOut = (concertStart().getTime() - now.getTime()) / 3_600_000
  if (hoursOut <= 0) return null
  for (const [w, target] of [['24h', 24], ['12h', 12], ['3h', 3]] as const) {
    if (Math.abs(hoursOut - target) <= 1.5) return w
  }
  return null
}

type Recipient = {
  id: string
  name: string
  email: string
  password_token: string | null
}

export async function GET(request: NextRequest) {
  // Verify Vercel Cron Secret if configured (same pattern as sync-stream).
  const authHeader = request.headers.get('Authorization')
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const requested = searchParams.get('window') as ReminderWindow | null
  const window = requested && WINDOWS.includes(requested) ? requested : inferWindow(new Date())

  if (!window) {
    return NextResponse.json(
      { ok: false, error: 'No reminder window — pass ?window=24h|12h|3h or run near the scheduled time.' },
      { status: 400 }
    )
  }

  const supabase = createServiceClient()

  // Recipients: every provisioned, non-banned member with an email + password.
  const { data: membersData, error: membersErr } = await supabase
    .from('members')
    .select('id, name, email, password_token')
    .eq('is_banned', false)
    .not('email', 'is', null)

  if (membersErr) {
    return NextResponse.json({ ok: false, error: membersErr.message }, { status: 500 })
  }

  const recipients = ((membersData ?? []) as Recipient[]).filter(
    (m) => m.email && m.password_token
  )

  // Skip anyone who already got this window. Best-effort: if the reminder_sends
  // table hasn't been migrated, proceed without dedup rather than failing.
  const alreadySent = new Set<string>()
  const { data: sentRows, error: sentErr } = await supabase
    .from('reminder_sends')
    .select('member_id')
    .eq('reminder_window', window)
  if (sentErr) {
    console.warn('reminder_sends unavailable; sending without dedup:', sentErr.message)
  } else {
    for (const row of sentRows ?? []) alreadySent.add((row as { member_id: string }).member_id)
  }

  const pending = recipients.filter((m) => !alreadySent.has(m.id))

  let sent = 0
  const failures: { email: string; error: string }[] = []

  for (const m of pending) {
    try {
      const { subject, html, text } = renderReminderEmail({
        name: m.name,
        email: m.email,
        password: m.password_token as string,
        memberId: m.id,
        window,
      })
      await sendEmail({ to: m.email, subject, html, text })
      sent++

      // Record the send so retries / overlapping runs don't double-email.
      // Best-effort: ignore if the table isn't migrated yet.
      await supabase
        .from('reminder_sends')
        .insert({ member_id: m.id, reminder_window: window })
    } catch (e) {
      failures.push({ email: m.email, error: e instanceof Error ? e.message : 'send failed' })
    }
    await sleep(SEND_DELAY_MS)
  }

  return NextResponse.json({
    ok: true,
    window,
    recipients: recipients.length,
    skipped_already_sent: recipients.length - pending.length,
    sent,
    failed: failures.length,
    failures: failures.slice(0, 20),
  })
}
