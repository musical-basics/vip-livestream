#!/usr/bin/env node
/**
 * Sync Shopify livestream purchasers → vip_livestream.members
 *
 * Pulls everyone who bought the Belgium Concert Livestream product from Shopify
 * and upserts them as members (each new member gets an assigned password).
 *
 * Idempotent: existing members (matched by email) keep their current
 * assigned password, so re-running never invalidates already-sent credentials.
 *
 * Usage:
 *   node --env-file=.env.local scripts/sync-shopify-livestream-members.mjs           # dry-run (default)
 *   node --env-file=.env.local scripts/sync-shopify-livestream-members.mjs --apply   # write to DB
 *
 * Required env (in .env.local):
 *   SHOPIFY_STORE_DOMAIN, SHOPIFY_ADMIN_API_TOKEN, SHOPIFY_API_VERSION
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   NEXT_PUBLIC_APP_URL (optional, for the login URL)
 */

import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

// The Belgium Concert Livestream variant (see belgium repo src/lib/checkout.ts).
const LIVESTREAM_VARIANT_ID = "43999228330027";

// Include paid + authorized (payment held but not yet captured).
const ACCEPTED_STATUSES = new Set(["paid", "partially_paid", "authorized"]);

const APPLY = process.argv.includes("--apply");

const shopDomain = process.env.SHOPIFY_STORE_DOMAIN;
const shopToken = process.env.SHOPIFY_ADMIN_API_TOKEN;
const shopVersion = process.env.SHOPIFY_API_VERSION || "2025-10";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://vip.musicalbasics.com";

if (!shopDomain || !shopToken) {
  console.error("❌ missing SHOPIFY_STORE_DOMAIN / SHOPIFY_ADMIN_API_TOKEN");
  process.exit(1);
}
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("❌ missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

console.log(`mode:  ${APPLY ? "APPLY (writing to DB)" : "DRY-RUN (no writes)"}`);
console.log(`store: ${shopDomain}`);
console.log(`app:   ${APP_URL}\n`);

// ─── 1. Pull livestream purchasers from Shopify (paginated) ─────────────────
function parseNextPageInfo(linkHeader) {
  if (!linkHeader) return null;
  for (const part of linkHeader.split(",")) {
    const m = part.match(/<([^>]+)>;\s*rel="next"/);
    if (m) return new URL(m[1]).searchParams.get("page_info");
  }
  return null;
}

const fields =
  "id,name,email,customer,line_items,financial_status,cancelled_at,refunds,created_at";
const base = `https://${shopDomain}/admin/api/${shopVersion}/orders.json`;

let pageInfo = null;
let page = 0;
const allOrders = [];
while (true) {
  page++;
  const url = pageInfo
    ? `${base}?limit=250&page_info=${encodeURIComponent(pageInfo)}`
    : `${base}?status=any&limit=250&fields=${fields}`;
  const res = await fetch(url, {
    headers: { "X-Shopify-Access-Token": shopToken, "Content-Type": "application/json" },
  });
  if (!res.ok) {
    console.error(`❌ shopify ${res.status}: ${await res.text()}`);
    process.exit(1);
  }
  const { orders } = await res.json();
  allOrders.push(...orders);
  process.stdout.write(`\r  scanning Shopify orders… ${allOrders.length}`);
  pageInfo = parseNextPageInfo(res.headers.get("link"));
  if (!pageInfo) break;
}
console.log(`\n  scanned ${allOrders.length} orders`);

// Collapse to one record per email; pick the best (paid > authorized) order.
const byEmail = new Map();
for (const o of allOrders) {
  const live = (o.line_items || []).some(
    (li) => String(li.variant_id) === LIVESTREAM_VARIANT_ID
  );
  if (!live) continue;

  const status = o.cancelled_at
    ? "cancelled"
    : (o.refunds || []).length > 0
      ? "refunded"
      : (o.financial_status || "").toLowerCase();
  if (!ACCEPTED_STATUSES.has(status)) continue;

  const c = o.customer || {};
  const email = (c.email || o.email || "").trim().toLowerCase();
  if (!email) continue;
  const name = `${c.first_name || ""} ${c.last_name || ""}`.trim() || email.split("@")[0];

  const existing = byEmail.get(email);
  // Prefer a captured (paid) order over a merely authorized one.
  const rank = (s) => (s === "paid" || s === "partially_paid" ? 2 : 1);
  if (!existing || rank(status) > rank(existing.status)) {
    byEmail.set(email, { name, email, status, order: o.name });
  }
}

const purchasers = [...byEmail.values()].sort((a, b) => a.name.localeCompare(b.name));
console.log(`  ${purchasers.length} unique livestream purchaser(s) (paid + authorized)\n`);

if (purchasers.length === 0) {
  console.log("nothing to sync.");
  process.exit(0);
}

// ─── 2. Reconcile against existing members ──────────────────────────────────
const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
  db: { schema: "vip_livestream" },
});

const emails = purchasers.map((p) => p.email);
const { data: existingRows, error: selErr } = await supabase
  .from("members")
  .select("id,email,password_token,name")
  .in("email", emails);
if (selErr) {
  console.error("❌ failed to read existing members:", selErr.message);
  process.exit(1);
}
const existingByEmail = new Map((existingRows || []).map((r) => [r.email, r]));

const toCreate = purchasers.filter((p) => !existingByEmail.has(p.email));
const alreadyMembers = purchasers.filter((p) => existingByEmail.has(p.email));

console.log(`plan: ${toCreate.length} new member(s), ${alreadyMembers.length} already exist\n`);

// ─── 3. Apply (or dry-run report) ───────────────────────────────────────────
const invites = [];

for (const p of alreadyMembers) {
  const row = existingByEmail.get(p.email);
  invites.push({
    name: p.name,
    email: p.email,
    status: "existing",
    password: row.password_token,
  });
}

for (const p of toCreate) {
  const token = crypto.randomUUID();
  if (APPLY) {
    const { data, error } = await supabase
      .from("members")
      .upsert(
        {
          name: p.name,
          email: p.email,
          password_token: token,
          display_name: p.name,
          is_moderator: false,
        },
        { onConflict: "email", ignoreDuplicates: false }
      )
      .select()
      .single();
    if (error) {
      console.error(`  ❌ ${p.email}: ${error.message}`);
      continue;
    }
    invites.push({
      name: p.name,
      email: p.email,
      status: "created",
      password: data.password_token,
    });
    console.log(`  ✅ created  ${p.name} <${p.email}>`);
  } else {
    invites.push({
      name: p.name,
      email: p.email,
      status: "would-create",
      password: `${token}  (password generated on --apply)`,
    });
    console.log(`  + would create  ${p.name} <${p.email}>  [${p.status}]`);
  }
}

// ─── 4. Summary + login credentials ─────────────────────────────────────────
console.log("\n─────────────────────────────────────");
console.log(APPLY ? "Login credentials:" : "Existing members' login credentials (re-runnable):");
console.log("─────────────────────────────────────");
for (const inv of invites) {
  console.log(`${inv.name} <${inv.email}>  [${inv.status}]`);
  console.log(`  Login: ${APP_URL}`);
  console.log(`  Password: ${inv.password}`);
}

if (!APPLY) {
  console.log(`\n(dry-run — re-run with --apply to create the ${toCreate.length} new member(s))`);
}
