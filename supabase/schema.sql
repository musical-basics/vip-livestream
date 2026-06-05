-- ============================================================
-- VIP Livestream — Supabase Database Schema
-- Run this in the Supabase SQL Editor
-- ============================================================

-- Create schema if not exists
CREATE SCHEMA IF NOT EXISTS vip_livestream;

-- Grant schema-level permissions
GRANT USAGE ON SCHEMA vip_livestream TO anon, authenticated, service_role;

-- Alter default privileges for future tables/sequences/functions
ALTER DEFAULT PRIVILEGES IN SCHEMA vip_livestream GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA vip_livestream GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA vip_livestream GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;

-- 1. Members table
CREATE TABLE IF NOT EXISTS vip_livestream.members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text UNIQUE NOT NULL,
  -- Internal name kept for compatibility; this is the assigned password emailed to the member.
  password_token text UNIQUE NOT NULL,
  access_badges text[] NOT NULL DEFAULT ARRAY['vip_member']::text[],
  display_name text,
  is_moderator boolean NOT NULL DEFAULT false,
  is_banned boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT members_access_badges_not_empty CHECK (coalesce(array_length(access_badges, 1), 0) > 0),
  CONSTRAINT members_access_badges_valid CHECK (
    access_badges <@ ARRAY['vip_member', 'private_student', 'dreamplay_buyer']::text[]
  )
);

ALTER TABLE vip_livestream.members
  ADD COLUMN IF NOT EXISTS access_badges text[] NOT NULL DEFAULT ARRAY['vip_member']::text[];

UPDATE vip_livestream.members
SET access_badges = ARRAY['vip_member']::text[]
WHERE coalesce(array_length(access_badges, 1), 0) = 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'members_access_badges_not_empty'
      AND conrelid = 'vip_livestream.members'::regclass
  ) THEN
    ALTER TABLE vip_livestream.members
      ADD CONSTRAINT members_access_badges_not_empty CHECK (coalesce(array_length(access_badges, 1), 0) > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'members_access_badges_valid'
      AND conrelid = 'vip_livestream.members'::regclass
  ) THEN
    ALTER TABLE vip_livestream.members
      ADD CONSTRAINT members_access_badges_valid CHECK (
        access_badges <@ ARRAY['vip_member', 'private_student', 'dreamplay_buyer']::text[]
      );
  END IF;
END $$;

-- 2. Streams table
CREATE TABLE IF NOT EXISTS vip_livestream.streams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  youtube_video_id text NOT NULL,
  stream_start_utc timestamptz,
  is_live boolean NOT NULL DEFAULT false,
  setlist jsonb,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Chat messages table
CREATE TABLE IF NOT EXISTS vip_livestream.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id uuid NOT NULL REFERENCES vip_livestream.streams(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES vip_livestream.members(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  content text,
  emoji text,
  is_muted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT content_or_emoji CHECK (content IS NOT NULL OR emoji IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_stream_id_created ON vip_livestream.chat_messages(stream_id, created_at DESC);

-- 4. Member timeouts table
CREATE TABLE IF NOT EXISTS vip_livestream.member_timeouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES vip_livestream.members(id) ON DELETE CASCADE,
  stream_id uuid NOT NULL REFERENCES vip_livestream.streams(id) ON DELETE CASCADE,
  muted_by uuid NOT NULL REFERENCES vip_livestream.members(id),
  timeout_until timestamptz, -- NULL = permanent
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_member_timeouts_member ON vip_livestream.member_timeouts(member_id, stream_id);

-- 5. Comments table (guestbook / leave-a-note)
CREATE TABLE IF NOT EXISTS vip_livestream.comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id uuid NOT NULL REFERENCES vip_livestream.streams(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES vip_livestream.members(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  content text NOT NULL,
  is_approved boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comments_stream ON vip_livestream.comments(stream_id, created_at);

-- 6. Tips table
CREATE TABLE IF NOT EXISTS vip_livestream.tips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id uuid NOT NULL REFERENCES vip_livestream.streams(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES vip_livestream.members(id) ON DELETE CASCADE,
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  stripe_session_id text UNIQUE,
  message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- Row Level Security (RLS)
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE vip_livestream.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE vip_livestream.streams ENABLE ROW LEVEL SECURITY;
ALTER TABLE vip_livestream.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE vip_livestream.member_timeouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE vip_livestream.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE vip_livestream.tips ENABLE ROW LEVEL SECURITY;

-- Grant all permissions on existing tables (just in case they already existed)
GRANT ALL ON ALL TABLES IN SCHEMA vip_livestream TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA vip_livestream TO anon, authenticated, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA vip_livestream TO anon, authenticated, service_role;

-- Members: only service role can read/write (all API calls use service role)
-- Realtime subscriptions use anon key but we use Broadcast (not DB changes) for chat
-- so no anon policies needed for members table

CREATE POLICY "Service role full access on members" ON vip_livestream.members
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on streams" ON vip_livestream.streams
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on chat_messages" ON vip_livestream.chat_messages
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on member_timeouts" ON vip_livestream.member_timeouts
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on comments" ON vip_livestream.comments
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on tips" ON vip_livestream.tips
  FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- Enable Realtime for Broadcast/Replication
-- ============================================================
-- In Supabase dashboard: Database > Replication > enable for chat_messages & streams
-- Or run:
ALTER PUBLICATION supabase_realtime ADD TABLE vip_livestream.chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE vip_livestream.streams;

-- ============================================================
-- Example: Insert a test stream
-- ============================================================
-- INSERT INTO vip_livestream.streams (title, youtube_video_id, is_live, description)
-- VALUES ('VIP Piano Recital — June 2026', 'YOUR_YOUTUBE_VIDEO_ID', false, 'An intimate evening of classical piano.');

-- Test livestream viewer
-- Login URL: https://vip.musicalbasics.com
-- Email: test@musicalbasics.com
-- Assigned password: test
-- Access badges: VIP Member
-- Moderator: yes, so right-click moderation can be tested
INSERT INTO vip_livestream.members (name, email, password_token, access_badges, display_name, is_moderator, is_banned)
VALUES ('Test Viewer', 'test@musicalbasics.com', 'test', ARRAY['vip_member']::text[], 'Test Viewer', true, false)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  password_token = EXCLUDED.password_token,
  access_badges = EXCLUDED.access_badges,
  display_name = EXCLUDED.display_name,
  is_moderator = true,
  is_banned = false;

-- ============================================================
-- Setlist
-- ============================================================
-- The default programme (currently the Belgium Concert) lives in CODE, not the
-- DB: lib/default-setlist.ts. Every stream whose streams.setlist is null/empty
-- renders that default, so test streams need no seeding. To give one stream a
-- different programme, set its streams.setlist (admin UI or the agent API:
--   PATCH /api/agent/stream  { "stream_id": "<uuid>", "setlist": [ ... ] }
-- A non-empty streams.setlist overrides the code default for that stream only.
