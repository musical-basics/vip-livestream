import { sendEmail } from '@/lib/livestream-email'

/**
 * Fan out a "viewers report the livestream is down" alert to the operators.
 *
 * Channels:
 *  - Email (always): recipients from STREAM_ALERT_EMAILS (comma-separated),
 *    defaulting to lionel@musicalbasics.com. Add the friend's address there.
 *  - Discord (optional): set DISCORD_ALERT_WEBHOOK_URL to a channel webhook for
 *    an instant phone push. Skipped silently if unset.
 *
 * Every send is best-effort and isolated so one channel failing never blocks the
 * others (or the viewer's request).
 */

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://vip.musicalbasics.com'

function alertEmails(): string[] {
  const raw = process.env.STREAM_ALERT_EMAILS || 'lionel@musicalbasics.com'
  return raw.split(',').map((s) => s.trim()).filter(Boolean)
}

export async function dispatchStreamDownAlert(opts: {
  streamTitle: string
  reportCount: number
}): Promise<{ emailed: number; discord: boolean }> {
  const { streamTitle, reportCount } = opts
  const watchUrl = `${APP_URL}/watch`
  const adminUrl = `${APP_URL}/admin`
  const subject = `⚠️ Livestream may be DOWN — ${reportCount} viewers reported it`

  const text = [
    `${reportCount} viewers just reported that the livestream is not playing.`,
    ``,
    `Stream: ${streamTitle}`,
    ``,
    `Check the feed. If it's dead, restart and paste the new link into the admin page:`,
    adminUrl,
    ``,
    `Watch page: ${watchUrl}`,
  ].join('\n')

  const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#111;">
    <p style="font-size:18px;font-weight:700;margin:0 0 10px;">⚠️ ${reportCount} viewers report the livestream is down</p>
    <p style="margin:0 0 4px;"><strong>Stream:</strong> ${streamTitle}</p>
    <p style="margin:14px 0 4px;">Check the feed. If it's dead, restart and paste the new link here:</p>
    <p style="margin:0 0 14px;"><a href="${adminUrl}">${adminUrl}</a></p>
    <p style="margin:0;color:#555;">Watch page: <a href="${watchUrl}">${watchUrl}</a></p>
  </div>`

  let emailed = 0
  for (const to of alertEmails()) {
    try {
      await sendEmail({ to, subject, html, text })
      emailed++
    } catch (e) {
      console.error('stream-down email failed for', to, e)
    }
  }

  let discord = false
  const webhook = process.env.DISCORD_ALERT_WEBHOOK_URL
  if (webhook) {
    try {
      const res = await fetch(webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: `🚨 **Livestream may be DOWN** — ${reportCount} viewers reported it.\nStream: **${streamTitle}**\nFix it: ${adminUrl}`,
        }),
      })
      discord = res.ok
    } catch (e) {
      console.error('stream-down Discord webhook failed', e)
    }
  }

  return { emailed, discord }
}
