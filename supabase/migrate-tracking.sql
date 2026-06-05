-- ============================================================
-- Tracking: login events + email opens
-- Run this ONCE in the Supabase SQL editor. Safe to re-run.
--
-- Powers /logs (who is logging in / failing) and /analytics (email open rate
-- and per-member participation).
-- ============================================================

-- Every login attempt (success or failure). member_id is null when the email
-- matched no member. reason is a short code: ok | bad_password | no_member | banned.
CREATE TABLE IF NOT EXISTS vip_livestream.login_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid REFERENCES vip_livestream.members(id) ON DELETE SET NULL,
  email text NOT NULL,
  success boolean NOT NULL,
  reason text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_login_events_created ON vip_livestream.login_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_events_member ON vip_livestream.login_events(member_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_events_email ON vip_livestream.login_events(lower(email), created_at DESC);

-- One row per credential-email open (tracking pixel hit).
CREATE TABLE IF NOT EXISTS vip_livestream.email_opens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES vip_livestream.members(id) ON DELETE CASCADE,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_email_opens_member ON vip_livestream.email_opens(member_id, created_at DESC);

ALTER TABLE vip_livestream.login_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE vip_livestream.email_opens ENABLE ROW LEVEL SECURITY;

GRANT ALL ON vip_livestream.login_events TO anon, authenticated, service_role;
GRANT ALL ON vip_livestream.email_opens TO anon, authenticated, service_role;

CREATE POLICY "Service role full access on login_events" ON vip_livestream.login_events
  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on email_opens" ON vip_livestream.email_opens
  FOR ALL USING (true) WITH CHECK (true);
