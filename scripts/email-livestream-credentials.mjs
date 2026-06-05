#!/usr/bin/env node
/**
 * Email livestream access credentials to all livestream ticket-holders.
 *
 * For each real member (test accounts excluded) it:
 *   1. assigns a fresh, easy-to-type 6-letter lowercase password,
 *   2. writes it to vip_livestream.members.password_token,
 *   3. emails them their login email + password via Resend.
 *
 * SAFE BY DEFAULT: dry-run unless --apply is passed. Dry-run writes nothing
 * and sends nothing:it prints exactly what would happen (with sample passwords).
 *
 * Usage:
 *   node --env-file=.env.local scripts/email-livestream-credentials.mjs                 # dry-run (default)
 *   node --env-file=.env.local scripts/email-livestream-credentials.mjs --only=you@x.com  # restrict to one/few (comma-sep)
 *   node --env-file=.env.local scripts/email-livestream-credentials.mjs --only=you@x.com --apply  # real test send to yourself
 *   node --env-file=.env.local scripts/email-livestream-credentials.mjs --apply         # rotate + send to everyone
 *
 * Required env (.env.local):
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY
 *   EMAIL_FROM            e.g. "Lionel Yu <vip@musicalbasics.com>" (domain must be verified in Resend)
 *   NEXT_PUBLIC_APP_URL   (optional; defaults to https://vip.musicalbasics.com)
 */

import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const APPLY = process.argv.includes("--apply");
// --no-send: with --apply, rotate the password in the DB but do NOT email anyone.
// Useful for handing yourself one real credential to test login.
const NO_SEND = process.argv.includes("--no-send");
const onlyArg = process.argv.find((a) => a.startsWith("--only="));
const ONLY = onlyArg
  ? new Set(onlyArg.slice("--only=".length).split(",").map((s) => s.trim().toLowerCase()))
  : null;
// --test=<email>: send ONE sample email (dummy password) to <email>, no DB reads/writes.
const testArg = process.argv.find((a) => a.startsWith("--test="));
const TEST_TO = testArg ? testArg.slice("--test=".length).trim() : null;
// --preview-to=<email>: with --only=<one member>, render that member's REAL email
// (their real stored password) and send it to <email> instead of the member. No writes.
const previewArg = process.argv.find((a) => a.startsWith("--preview-to="));
const PREVIEW_TO = previewArg ? previewArg.slice("--preview-to=".length).trim() : null;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://vip.musicalbasics.com";
const EMAIL_FROM = process.env.EMAIL_FROM || "Lionel Yu <lionel@musicalbasics.com>";
const REPLY_TO = process.env.EMAIL_REPLY_TO || "lionel@musicalbasics.com";

// Concert details (for the email body).
const CONCERT = {
  name: "Belgium Concert",
  dateLine: "Thursday 11 June 2026",
};

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("❌ missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
if (APPLY && !RESEND_API_KEY) {
  console.error("❌ --apply requires RESEND_API_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  db: { schema: "vip_livestream" },
});

const isTestAccount = (m) =>
  /@example\.com$/i.test(m.email) || /^test@musicalbasics\.com$/i.test(m.email);

// 6 lowercase letters, no capitals, easy to type. Exclude none; pure a-z.
const ALPHABET = "abcdefghijklmnopqrstuvwxyz";
function makePassword() {
  let p = "";
  for (let i = 0; i < 6; i++) p += ALPHABET[crypto.randomInt(ALPHABET.length)];
  return p;
}
function uniquePassword(used) {
  let p;
  do { p = makePassword(); } while (used.has(p));
  used.add(p);
  return p;
}

function firstName(name) {
  return (name || "").trim().split(/\s+/)[0] || "there";
}

function renderEmail({ name, email, password }) {
  const greeting = firstName(name);
  // Direct link: opens the login page with email + password pre-filled and logs in automatically.
  const directUrl = `${APP_URL}/?email=${encodeURIComponent(email)}&pw=${encodeURIComponent(password)}`;
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
  ].join("\n");

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
            <p style="margin:0 0 14px;font-size:12px;line-height:1.5;color:#9a9aa2;">Prefer to sign in by hand? Go to <a href="${APP_URL}" style="color:#c5a253;text-decoration:none;">${APP_URL.replace(/^https?:\/\//, "")}</a> and enter:</p>
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
</body></html>`;

  return { text, html };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function sendEmail({ to, subject, html, text }) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: EMAIL_FROM, to, reply_to: REPLY_TO, subject, html, text }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.message || `Resend HTTP ${res.status}`);
  return body.id;
}

async function main() {
  // --test mode: one sample email, no DB involvement.
  if (TEST_TO) {
    if (!RESEND_API_KEY) { console.error("❌ --test requires RESEND_API_KEY"); process.exit(1); }
    const subject = `Your VIP access for the ${CONCERT.name} livestream`;
    const { html, text } = renderEmail({ name: "Lionel", email: TEST_TO, password: "abcxyz" });
    console.log(`TEST send → ${TEST_TO}`);
    console.log(`From:        ${EMAIL_FROM}`);
    console.log(`(sample only:password "abcxyz" is not real and nothing is written to the DB)\n`);
    try {
      const id = await sendEmail({ to: TEST_TO, subject, html, text });
      console.log(`✓ sent (Resend id ${id}). Check your inbox.`);
    } catch (e) {
      console.log(`✗ FAILED:${e.message}`);
      console.log(`   If this mentions domain/verification, the From domain isn't verified in Resend yet.`);
      process.exit(1);
    }
    return;
  }

  const { data: all, error } = await supabase
    .from("members")
    .select("id,name,email,password_token,access_badges")
    .order("created_at");
  if (error) { console.error("❌ DB read failed:", error.message); process.exit(1); }

  // --preview-to: send one real member's real email to a chosen inbox, no writes.
  if (PREVIEW_TO) {
    if (!ONLY || ONLY.size !== 1) {
      console.error("❌ --preview-to requires --only=<exactly one member email>");
      process.exit(1);
    }
    const m = all.find((x) => ONLY.has(x.email.toLowerCase()));
    if (!m) { console.error("❌ no member matches --only"); process.exit(1); }
    const subject = `Your VIP access for the ${CONCERT.name} livestream`;
    const { html, text } = renderEmail({ name: m.name, email: m.email, password: m.password_token });
    console.log(`PREVIEW of ${m.email}'s real email -> ${PREVIEW_TO}`);
    console.log(`(real password ${m.password_token}; nothing written to the DB; ${m.email} is NOT emailed)\n`);
    const id = await sendEmail({ to: PREVIEW_TO, subject, html, text });
    console.log(`sent (Resend id ${id}). Check ${PREVIEW_TO}.`);
    return;
  }

  let recipients = all.filter((m) => !isTestAccount(m));
  if (ONLY) recipients = recipients.filter((m) => ONLY.has(m.email.toLowerCase()));

  const usedPasswords = new Set(all.map((m) => m.password_token).filter(Boolean));

  console.log(`Mode:        ${APPLY ? "APPLY (rotating passwords + sending)" : "DRY-RUN (no writes, no sends)"}`);
  console.log(`From:        ${EMAIL_FROM}`);
  console.log(`Reply-To:    ${REPLY_TO}`);
  console.log(`Login URL:   ${APP_URL}`);
  console.log(`Recipients:  ${recipients.length}${ONLY ? " (filtered by --only)" : ""}\n`);

  if (recipients.length === 0) { console.log("Nothing to do."); return; }

  const subject = `Your VIP access for the ${CONCERT.name} livestream`;
  let sent = 0;
  const failures = [];

  for (const m of recipients) {
    const password = uniquePassword(usedPasswords);
    if (!APPLY) {
      console.log(`  would email  ${m.email.padEnd(34)} pw=${password}`);
      continue;
    }
    try {
      // Rotate first so the emailed password is the one stored in the DB.
      const { error: upErr } = await supabase
        .from("members").update({ password_token: password }).eq("id", m.id);
      if (upErr) throw new Error(`DB update: ${upErr.message}`);

      if (NO_SEND) {
        console.log(`  rotated (no email)  ${m.email.padEnd(34)} pw=${password}`);
        continue;
      }

      const { html, text } = renderEmail({ name: m.name, email: m.email, password });
      const id = await sendEmail({ to: m.email, subject, html, text });
      sent++;
      console.log(`  sent  ${m.email.padEnd(34)} pw=${password}  (id ${id})`);
    } catch (e) {
      failures.push({ email: m.email, password, error: e.message });
      console.log(`  ✗ FAILED     ${m.email.padEnd(34)} pw=${password} :${e.message}`);
    }
    // Stay under Resend's 5 requests/second limit.
    await sleep(300);
  }

  if (APPLY) {
    console.log(`\nDone. Sent ${sent}/${recipients.length}.`);
    if (failures.length) {
      console.log(`\n⚠️  ${failures.length} failure(s):password was rotated but email did not send.`);
      console.log(`   Re-run for just these: --only=${failures.map((f) => f.email).join(",")}`);
      failures.forEach((f) => console.log(`   ${f.email}  pw=${f.password}  (${f.error})`));
    }
  } else {
    console.log(`\n(dry-run:re-run with --apply to rotate passwords and send)`);
  }
}

main().catch((e) => { console.error("❌", e); process.exit(1); });
