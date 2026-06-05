import crypto from 'node:crypto'

/**
 * Livestream credential email (login link + email/password), sent via Resend.
 *
 * Shared by the agent API (POST /api/agent/email-credentials) so the agent can
 * deliver credentials on a one-off basis. Mirrors the template in
 * scripts/email-livestream-credentials.mjs — keep the two in sync if edited.
 *
 * Passwords are never rotated here: callers reuse a member's stored password.
 * makePassword() exists only to assign one to a brand-new member that has none.
 */

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://vip.musicalbasics.com'
const EMAIL_FROM = process.env.EMAIL_FROM || 'Lionel Yu <lionel@musicalbasics.com>'
const REPLY_TO = process.env.EMAIL_REPLY_TO || 'lionel@musicalbasics.com'

export const CONCERT = {
  name: 'Belgium Concert',
  dateLine: 'Thursday 11 June 2026',
}

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz'

/** A fresh 6-letter lowercase password (only for members who have none yet). */
export function makePassword(): string {
  let p = ''
  for (let i = 0; i < 6; i++) p += ALPHABET[crypto.randomInt(ALPHABET.length)]
  return p
}

function firstName(name: string) {
  return (name || '').trim().split(/\s+/)[0] || 'there'
}

export function renderCredentialsEmail({
  name,
  email,
  password,
  memberId,
}: {
  name: string
  email: string
  password: string
  /** When set, embeds an open-tracking pixel (/api/track/open?m=<id>). */
  memberId?: string
}) {
  const greeting = firstName(name)
  const directUrl = `${APP_URL}/?email=${encodeURIComponent(email)}&pw=${encodeURIComponent(password)}`
  const subject = `Your VIP access for the ${CONCERT.name} livestream`
  const trackingPixel = memberId
    ? `<img src="${APP_URL}/api/track/open?m=${encodeURIComponent(memberId)}" width="1" height="1" alt="" style="display:none;width:1px;height:1px;" />`
    : ''

  const text = [
    `Hi ${greeting},`,
    ``,
    `Your access to the ${CONCERT.name} livestream (${CONCERT.dateLine}) is ready.`,
    ``,
    `One-click access (logs you in automatically):`,
    directUrl,
    ``,
    `Prefer to sign in by hand? Go to ${APP_URL} and enter:`,
    `Email: ${email}`,
    `Password: ${password}`,
    ``,
    `Please keep these details private. They're unique to you.`,
    ``,
    `See you at the concert,`,
    `Lionel`,
  ].join('\n')

  const html = `<!doctype html><html><body style="margin:0;background:#0d0d10;padding:32px 0;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#e8e8ea;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;background:#15151a;border:1px solid #26262e;border-radius:16px;overflow:hidden;">
      <tr><td style="padding:32px 36px 8px;">
        <p style="margin:0 0 4px;font-size:13px;letter-spacing:2px;text-transform:uppercase;color:#9a8a55;">VIP Livestream</p>
        <h1 style="margin:0 0 16px;font-size:22px;font-weight:600;color:#fff;">You're on the guest list</h1>
        <p style="margin:0 0 8px;font-size:15px;line-height:1.6;color:#c7c7cc;">Hi ${greeting},</p>
        <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#c7c7cc;">Your access to the <strong style="color:#fff;">${CONCERT.name}</strong> livestream (${CONCERT.dateLine}) is ready.</p>
        <a href="${directUrl}" style="display:block;text-align:center;background:#c5a253;color:#1a1a1a;text-decoration:none;font-weight:600;font-size:16px;padding:16px 28px;border-radius:10px;">Join the livestream &rarr;</a>
        <p style="margin:12px 0 26px;font-size:13px;line-height:1.6;color:#8a8a92;text-align:center;">One click, nothing to type. The link logs you in automatically.</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0f0f13;border:1px solid #26262e;border-radius:12px;margin:0;">
          <tr><td style="padding:18px 20px;">
            <p style="margin:0 0 14px;font-size:12px;line-height:1.5;color:#9a9aa2;">Prefer to sign in by hand? Go to <a href="${APP_URL}" style="color:#c5a253;text-decoration:none;">${APP_URL.replace(/^https?:\/\//, '')}</a> and enter:</p>
            <p style="margin:0 0 4px;font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#7a7a82;">Your email</p>
            <p style="margin:0 0 14px;font-size:16px;color:#fff;font-family:ui-monospace,Menlo,Consolas,monospace;"><a href="${directUrl}" style="color:#fff;text-decoration:none;">${email}</a></p>
            <p style="margin:0 0 4px;font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#7a7a82;">Your password</p>
            <p style="margin:0;font-size:22px;letter-spacing:3px;color:#fff;font-family:ui-monospace,Menlo,Consolas,monospace;">${password}</p>
          </td></tr>
        </table>
        <p style="margin:22px 0 0;font-size:13px;line-height:1.6;color:#8a8a92;">Please keep these details private. They're unique to you.</p>
      </td></tr>
      <tr><td style="padding:20px 36px 32px;border-top:1px solid #26262e;">
        <p style="margin:0;font-size:14px;color:#c7c7cc;">See you at the concert,<br/>Lionel</p>
      </td></tr>
    </table>
  </td></tr></table>
  ${trackingPixel}
</body></html>`

  return { subject, text, html }
}

/** Send one credential email via Resend. Returns the Resend message id. */
export async function sendCredentialsEmail({
  to,
  subject,
  html,
  text,
}: {
  to: string
  subject: string
  html: string
  text: string
}): Promise<string> {
  const RESEND_API_KEY = process.env.RESEND_API_KEY
  if (!RESEND_API_KEY) throw new Error('RESEND_API_KEY is not set in the environment')

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: EMAIL_FROM, to, reply_to: REPLY_TO, subject, html, text }),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body?.message || `Resend HTTP ${res.status}`)
  return body.id
}
