-- Migration: track which pre-livestream reminder emails each member has been
-- sent (24h / 12h / 3h windows), so the cron at /api/cron/livestream-reminder
-- never double-emails on retries or overlapping runs.
--
-- Run in the Supabase SQL editor. Safe to run more than once.

CREATE TABLE IF NOT EXISTS vip_livestream.reminder_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES vip_livestream.members(id) ON DELETE CASCADE,
  reminder_window text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (member_id, reminder_window)
);

CREATE INDEX IF NOT EXISTS idx_reminder_sends_window
  ON vip_livestream.reminder_sends (reminder_window);
