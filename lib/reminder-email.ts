import { CONCERT, concertStart } from '@/lib/concert'

/**
 * Countdown reminder emails sent before the livestream (24h / 12h / 3h out),
 * via Resend (reuses sendEmail from livestream-email). Includes a one-click
 * join link plus the start time in several timezones, and a link that shows the
 * start time in the reader's *own* local timezone (timeanddate auto-converts).
 *
 * Emails can't run JavaScript, so the reader's exact timezone can't be detected
 * at send time — the multi-zone list and the auto-converting link are the
 * reliable ways to "include info about the person's local time zone".
 */

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://vip.musicalbasics.com'

export type ReminderWindow = '24h' | '12h' | '3h'

const WINDOW_COPY: Record<ReminderWindow, { kicker: string; lead: string }> = {
  '24h': {
    kicker: '24 hours to go',
    lead: 'The livestream is almost here — it begins in about 24 hours.',
  },
  '12h': {
    kicker: '12 hours to go',
    lead: 'Just 12 hours until the livestream begins.',
  },
  '3h': {
    kicker: 'Starting in 3 hours',
    lead: 'Final reminder — the livestream begins in about 3 hours.',
  },
}

/** Major timezones to spell the start time out in, so most readers see theirs. */
const TIMEZONES: { tz: string; label: string }[] = [
  { tz: 'Europe/Brussels', label: 'Brussels / CET' },
  { tz: 'Europe/London', label: 'London' },
  { tz: 'America/New_York', label: 'New York' },
  { tz: 'America/Los_Angeles', label: 'Los Angeles' },
]

function formatInZone(tz: string): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
    timeZone: tz,
  }).format(concertStart())
}

/**
 * timeanddate "fixed time" link — renders the event in whatever timezone the
 * reader is browsing from. iso is the start in the concert's local wall time
 * (19:30) anchored to p1=48 (Brussels).
 */
const LOCAL_TIME_URL =
  'https://www.timeanddate.com/worldclock/fixedtime.html?msg=' +
  encodeURIComponent(`${CONCERT.name} livestream`) +
  '&iso=20260611T1930&p1=48'

function firstName(name: string) {
  return (name || '').trim().split(/\s+/)[0] || 'there'
}

export function renderReminderEmail({
  name,
  email,
  password,
  memberId,
  window,
}: {
  name: string
  email: string
  password: string
  /** When set, embeds an open-tracking pixel (/api/track/open?m=<id>). */
  memberId?: string
  window: ReminderWindow
}) {
  const greeting = firstName(name)
  const copy = WINDOW_COPY[window]
  const directUrl = `${APP_URL}/?email=${encodeURIComponent(email)}&pw=${encodeURIComponent(password)}`
  const subject = `${CONCERT.name} livestream — ${copy.kicker}`
  const trackingPixel = memberId
    ? `<img src="${APP_URL}/api/track/open?m=${encodeURIComponent(memberId)}" width="1" height="1" alt="" style="display:none;width:1px;height:1px;" />`
    : ''

  const zoneLines = TIMEZONES.map(({ tz, label }) => `${label}: ${formatInZone(tz)}`)

  const text = [
    `Hi ${greeting},`,
    ``,
    copy.lead,
    ``,
    `Start time: ${CONCERT.startLabelCest}`,
    ...zoneLines,
    ``,
    `See it in your own local time: ${LOCAL_TIME_URL}`,
    ``,
    `Join the livestream (logs you in automatically):`,
    directUrl,
    ``,
    `See you there,`,
    `Lionel`,
  ].join('\n')

  const zoneRows = TIMEZONES.map(
    ({ tz, label }) => `
            <tr>
              <td style="padding:2px 0;font-size:13px;color:#8a8a92;">${label}</td>
              <td style="padding:2px 0;font-size:13px;color:#e8e8ea;text-align:right;">${formatInZone(tz)}</td>
            </tr>`
  ).join('')

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
  ${trackingPixel}
</body></html>`

  return { subject, text, html }
}
