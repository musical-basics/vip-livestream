/**
 * Send preview copies of the pre-livestream reminder emails (24h / 12h / 3h).
 *
 * Mirrors the template in lib/reminder-email.ts — keep the two in sync if edited
 * (same arrangement the credentials email + scripts/email-livestream-credentials.mjs use).
 *
 * Usage:
 *   node --env-file=.env.local scripts/preview-reminder-email.mjs --to=you@example.com
 *   node --env-file=.env.local scripts/preview-reminder-email.mjs --to=you@example.com --window=24h
 *
 * Sends sequentially with a delay (same throttle as the cron) so it never blasts.
 */

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://vip.musicalbasics.com'
const EMAIL_FROM = process.env.EMAIL_FROM || 'Lionel Yu <lionel@musicalbasics.com>'
const REPLY_TO = process.env.EMAIL_REPLY_TO || 'lionel@musicalbasics.com'
const SEND_DELAY_MS = 300

const CONCERT = {
  name: 'Belgium Concert',
  startLabelCest: 'Thursday, June 11th, 2026 at 7:30 PM CEST',
  startUtc: '2026-06-11T17:30:00.000Z',
}

const WINDOW_COPY = {
  '24h': { kicker: '24 hours to go', lead: 'The livestream is almost here — it begins in about 24 hours.' },
  '12h': { kicker: '12 hours to go', lead: 'Just 12 hours until the livestream begins.' },
  '3h': { kicker: 'Starting in 3 hours', lead: 'Final reminder — the livestream begins in about 3 hours.' },
}

const TIMEZONES = [
  { tz: 'Europe/Brussels', label: 'Brussels / CET' },
  { tz: 'Europe/London', label: 'London' },
  { tz: 'America/New_York', label: 'New York' },
  { tz: 'America/Los_Angeles', label: 'Los Angeles' },
]

function formatInZone(tz) {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit', timeZoneName: 'short', timeZone: tz,
  }).format(new Date(CONCERT.startUtc))
}

const LOCAL_TIME_URL =
  'https://www.timeanddate.com/worldclock/fixedtime.html?msg=' +
  encodeURIComponent(`${CONCERT.name} livestream`) + '&iso=20260611T1930&p1=48'

function firstName(name) {
  return (name || '').trim().split(/\s+/)[0] || 'there'
}

function renderReminderEmail({ name, email, password, window }) {
  const greeting = firstName(name)
  const copy = WINDOW_COPY[window]
  const directUrl = `${APP_URL}/?email=${encodeURIComponent(email)}&pw=${encodeURIComponent(password)}`
  const subject = `${CONCERT.name} livestream — ${copy.kicker}`

  const zoneRows = TIMEZONES.map(({ tz, label }) => `
            <tr>
              <td style="padding:2px 0;font-size:13px;color:#8a8a92;">${label}</td>
              <td style="padding:2px 0;font-size:13px;color:#e8e8ea;text-align:right;">${formatInZone(tz)}</td>
            </tr>`).join('')

  const text = [
    `Hi ${greeting},`, ``, copy.lead, ``,
    `Start time: ${CONCERT.startLabelCest}`,
    ...TIMEZONES.map(({ tz, label }) => `${label}: ${formatInZone(tz)}`), ``,
    `See it in your own local time: ${LOCAL_TIME_URL}`, ``,
    `Join the livestream (logs you in automatically):`, directUrl, ``,
    `See you there,`, `Lionel`,
  ].join('\n')

  const html = `<!doctype html><html><body style="margin:0;background:#0d0d10;padding:32px 0;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#e8e8ea;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;background:#15151a;border:1px solid #26262e;border-radius:16px;overflow:hidden;">
      <tr><td style="padding:32px 36px 8px;">
        <p style="margin:0 0 4px;font-size:13px;letter-spacing:2px;text-transform:uppercase;color:#9a8a55;">${copy.kicker}</p>
        <h1 style="margin:0 0 16px;font-size:22px;font-weight:600;color:#fff;">${CONCERT.name} livestream</h1>
        <p style="margin:0 0 8px;font-size:15px;line-height:1.6;color:#c7c7cc;">Hi ${greeting},</p>
        <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#c7c7cc;">${copy.lead}</p>
        <a href="${directUrl}" style="display:block;text-align:center;background:#c5a253;color:#1a1a1a;text-decoration:none;font-weight:600;font-size:16px;padding:16px 28px;border-radius:10px;">Join the livestream &rarr;</a>
        <p style="margin:12px 0 24px;font-size:13px;line-height:1.6;color:#8a8a92;text-align:center;">One click, nothing to type. The link logs you in automatically.</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0f0f13;border:1px solid #26262e;border-radius:12px;margin:0;">
          <tr><td style="padding:18px 20px;">
            <p style="margin:0 0 6px;font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#7a7a82;">Starts</p>
            <p style="margin:0 0 14px;font-size:16px;color:#fff;">${CONCERT.startLabelCest}</p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${zoneRows}</table>
            <p style="margin:14px 0 0;font-size:12px;line-height:1.5;color:#9a9aa2;">In a different timezone? <a href="${LOCAL_TIME_URL}" style="color:#c5a253;text-decoration:none;">See it in your local time &rarr;</a></p>
          </td></tr>
        </table>
      </td></tr>
      <tr><td style="padding:20px 36px 32px;border-top:1px solid #26262e;">
        <p style="margin:0;font-size:14px;color:#c7c7cc;">See you there,<br/>Lionel</p>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`

  return { subject, text, html }
}

async function sendEmail({ to, subject, html, text }) {
  const RESEND_API_KEY = process.env.RESEND_API_KEY
  if (!RESEND_API_KEY) throw new Error('RESEND_API_KEY is not set in the environment')
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: EMAIL_FROM, to, reply_to: REPLY_TO, subject, html, text }),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body?.message || `Resend HTTP ${res.status}`)
  return body.id
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const args = process.argv.slice(2)
  const to = (args.find((a) => a.startsWith('--to=')) || '').slice('--to='.length)
  const onlyWindow = (args.find((a) => a.startsWith('--window=')) || '').slice('--window='.length)
  if (!to) {
    console.error('Missing --to=email@example.com')
    process.exit(1)
  }
  const windows = onlyWindow ? [onlyWindow] : ['24h', '12h', '3h']
  const name = (args.find((a) => a.startsWith('--name=')) || '--name=Lionel').slice('--name='.length)
  // Placeholder password — the preview shows the layout; the one-click link is illustrative.
  const password = 'preview'

  for (const window of windows) {
    const { subject, html, text } = renderReminderEmail({ name, email: to, password, window })
    const id = await sendEmail({ to, subject: `[PREVIEW] ${subject}`, html, text })
    console.log(`Sent ${window} preview to ${to} (Resend id ${id})`)
    await sleep(SEND_DELAY_MS)
  }
  console.log('Done.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
