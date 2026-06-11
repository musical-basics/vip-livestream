#!/usr/bin/env node
/**
 * Manually add a livestream member by email (comp / guest / your own address).
 *
 * The Shopify sync only ever creates members for real buyers; this is the escape
 * hatch for adding someone who didn't buy through Shopify (e.g. a comp guest or
 * your own test inbox) so they show up on the customer list and can be emailed
 * their access with scripts/email-livestream-credentials.mjs.
 *
 * Idempotent: an email that already exists is left untouched (its assigned
 * password is preserved, so any credentials already sent keep working). New
 * members get a UUID placeholder token — the credential emailer swaps it for a
 * typable 6-letter password on first send, exactly like buyers from the sync.
 *
 * SAFE BY DEFAULT: dry-run unless --apply is passed.
 *
 * Usage:
 *   node --env-file=.env.local scripts/add-livestream-member.mjs --email=you@example.com                 # dry-run
 *   node --env-file=.env.local scripts/add-livestream-member.mjs --email=you@example.com --name="Lionel" --apply
 *   node --env-file=.env.local scripts/add-livestream-member.mjs --email=a@x.com,b@y.com --apply          # several at once
 *
 * Required env (.env.local): NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * After adding, deliver their access:
 *   node --env-file=.env.local scripts/email-livestream-credentials.mjs --only=you@example.com --apply
 */

import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const APPLY = process.argv.includes("--apply");

const emailArg = process.argv.find((a) => a.startsWith("--email="));
const nameArg = process.argv.find((a) => a.startsWith("--name="));
const badgesArg = process.argv.find((a) => a.startsWith("--badges="));

const EMAILS = emailArg
  ? emailArg
      .slice("--email=".length)
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  : [];
const NAME_OVERRIDE = nameArg ? nameArg.slice("--name=".length).trim() : null;
const BADGES = badgesArg
  ? badgesArg.slice("--badges=".length).split(",").map((s) => s.trim()).filter(Boolean)
  : ["vip_member"];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("❌ missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
if (EMAILS.length === 0) {
  console.error("❌ pass --email=a@b.com (comma-separated for several)");
  process.exit(1);
}
const invalid = EMAILS.filter((e) => !EMAIL_RE.test(e));
if (invalid.length) {
  console.error(`❌ invalid email(s): ${invalid.join(", ")}`);
  process.exit(1);
}

function deriveName(email) {
  if (NAME_OVERRIDE) return NAME_OVERRIDE;
  const local = email.split("@")[0].replace(/[._-]+/g, " ").trim();
  return local.replace(/\b\w/g, (c) => c.toUpperCase()) || email;
}

function isMissingAccessBadgesColumn(error) {
  return error?.code === "PGRST204" || error?.message?.includes("access_badges");
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
  db: { schema: "vip_livestream" },
});

console.log(`mode:  ${APPLY ? "APPLY (writing to DB)" : "DRY-RUN (no writes)"}`);
console.log(`badges: ${BADGES.join(", ") || "(none)"}\n`);

const { data: existingRows, error: selErr } = await supabase
  .from("members")
  .select("id,email,name")
  .in("email", EMAILS);
if (selErr) {
  console.error("❌ failed to read existing members:", selErr.message);
  process.exit(1);
}
const existing = new Set((existingRows || []).map((r) => r.email.toLowerCase()));

let created = 0;
for (const email of EMAILS) {
  if (existing.has(email)) {
    console.log(`  • exists (unchanged)   ${email}`);
    continue;
  }
  const name = deriveName(email);
  if (!APPLY) {
    console.log(`  + would create         ${email}  as "${name}"`);
    continue;
  }
  const payload = {
    name,
    email,
    password_token: crypto.randomUUID(),
    access_badges: BADGES,
    display_name: name,
    is_moderator: false,
  };
  let { error } = await supabase.from("members").insert(payload);
  if (error && isMissingAccessBadgesColumn(error)) {
    const { access_badges: _drop, ...legacy } = payload;
    ({ error } = await supabase.from("members").insert(legacy));
  }
  if (error) {
    // Unique-email race / already there → treat as exists.
    if (error.code === "23505") {
      console.log(`  • exists (unchanged)   ${email}`);
      continue;
    }
    console.error(`  ❌ ${email}: ${error.message}`);
    continue;
  }
  created++;
  console.log(`  ✅ created             ${email}  as "${name}"`);
}

console.log(`\n${APPLY ? `Done. Created ${created} new member(s).` : "(dry-run — re-run with --apply to create)"}`);
console.log(
  `Next, email their access:\n  node --env-file=.env.local scripts/email-livestream-credentials.mjs --only=${EMAILS.join(",")} --apply`
);
