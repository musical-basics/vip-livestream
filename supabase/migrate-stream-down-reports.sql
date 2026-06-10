-- Migration: crowd-sourced "stream is down" reporting.
--
-- Viewers tap a button when the feed isn't playing; once enough DISTINCT viewers
-- report within a short window, the API (/api/stream/report-down) emails the
-- operators (and optionally pings a Discord webhook). The encoder/app often
-- claims it's "still live" when the feed is actually black, so viewers are the
-- real signal.
--
-- Run in the Supabase SQL editor. Safe to run more than once.

-- One row per viewer report (deduped to ~1 per member per window by the API).
CREATE TABLE IF NOT EXISTS vip_livestream.stream_down_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id uuid NOT NULL REFERENCES vip_livestream.streams(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES vip_livestream.members(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stream_down_reports_stream_created
  ON vip_livestream.stream_down_reports (stream_id, created_at DESC);

-- One row each time an alert actually fires — used for the cooldown so a wave of
-- reports doesn't spam the operators.
CREATE TABLE IF NOT EXISTS vip_livestream.stream_down_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id uuid NOT NULL REFERENCES vip_livestream.streams(id) ON DELETE CASCADE,
  report_count integer NOT NULL DEFAULT 0,
  alerted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stream_down_alerts_stream_created
  ON vip_livestream.stream_down_alerts (stream_id, alerted_at DESC);

-- Only the API's service-role client touches these (service role bypasses RLS),
-- so enable RLS with no policies to deny the public anon/authenticated keys.
ALTER TABLE vip_livestream.stream_down_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE vip_livestream.stream_down_alerts ENABLE ROW LEVEL SECURITY;
