#!/usr/bin/env node
/**
 * Strip the legacy `dreamplay_buyer` access badge from all members.
 *
 * The badge was auto-applied to every Shopify livestream buyer (webhook + sync),
 * but the "DreamPlay Buyer" feature was never set up, so it should not show.
 * This replaces it with the default `vip_member` badge — the members table
 * forbids an empty access_badges array (members_access_badges_not_empty) — while
 * preserving any other valid badge a member already has.
 *
 * SAFE BY DEFAULT: dry-run unless --apply is passed. Dry-run writes nothing.
 *
 * Usage:
 *   node --env-file=.env.local scripts/strip-dreamplay-buyer-badge.mjs            # dry-run
 *   node --env-file=.env.local scripts/strip-dreamplay-buyer-badge.mjs --apply    # write
 *
 * Required env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "@supabase/supabase-js";

const APPLY = process.argv.includes("--apply");
const LEGACY = "dreamplay_buyer";
const FALLBACK = "vip_member";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("❌ missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
  db: { schema: "vip_livestream" },
});

console.log(`mode: ${APPLY ? "APPLY (writing to DB)" : "DRY-RUN (no writes)"}\n`);

const { data: rows, error } = await supabase
  .from("members")
  .select("id,name,email,access_badges")
  .contains("access_badges", [LEGACY]);
if (error) {
  console.error("❌ read failed:", error.message);
  process.exit(1);
}

if (!rows || rows.length === 0) {
  console.log(`No members carry "${LEGACY}". Nothing to do.`);
  process.exit(0);
}

console.log(`${rows.length} member(s) carry "${LEGACY}":\n`);

let changed = 0;
for (const m of rows) {
  const before = Array.isArray(m.access_badges) ? m.access_badges : [];
  let next = [...new Set(before.filter((b) => b !== LEGACY))];
  if (next.length === 0) next = [FALLBACK];
  console.log(`  ${(m.email || "").padEnd(34)} [${before.join(", ")}] -> [${next.join(", ")}]`);
  if (!APPLY) continue;
  const { error: upErr } = await supabase
    .from("members")
    .update({ access_badges: next })
    .eq("id", m.id);
  if (upErr) {
    console.error(`    ❌ ${m.email}: ${upErr.message}`);
    continue;
  }
  changed++;
}

if (APPLY) {
  const { data: remaining } = await supabase
    .from("members")
    .select("id")
    .contains("access_badges", [LEGACY]);
  console.log(`\nDone. Updated ${changed} member(s). Remaining with "${LEGACY}": ${remaining?.length ?? "?"}.`);
} else {
  console.log(`\n(dry-run — re-run with --apply to update ${rows.length} member(s))`);
}
