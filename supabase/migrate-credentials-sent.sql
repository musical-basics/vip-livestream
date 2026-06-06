-- Track which members have already been emailed their login credentials.
-- Powers the Shopify webhook auto-send and the "email only those who haven't
-- received yet" backfill (scripts/email-livestream-credentials.mjs --unsent-only).
--
-- Run once in the Supabase SQL editor (schema: vip_livestream).

alter table vip_livestream.members
  add column if not exists credentials_sent_at timestamptz;

-- Backfill: everyone who currently has a short (6-letter) password was already
-- emailed by scripts/email-livestream-credentials.mjs on 2026-06-04. Members
-- still holding a long UUID token were created by the webhook / sync script and
-- have NEVER been emailed, so they stay NULL and the backfill will pick them up.
update vip_livestream.members
   set credentials_sent_at = created_at
 where credentials_sent_at is null
   and char_length(password_token) <= 8;
