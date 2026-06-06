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
  is_admin boolean NOT NULL DEFAULT false,
  is_banned boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- When the member was emailed their login credentials (null = never sent).
  credentials_sent_at timestamptz,
  CONSTRAINT members_access_badges_not_empty CHECK (coalesce(array_length(access_badges, 1), 0) > 0),
  CONSTRAINT members_access_badges_valid CHECK (
    access_badges <@ ARRAY['vip_member', 'private_student', 'dreamplay_buyer']::text[]
  )
);

ALTER TABLE vip_livestream.members
  ADD COLUMN IF NOT EXISTS access_badges text[] NOT NULL DEFAULT ARRAY['vip_member']::text[];

-- Roles: is_admin (full access, can assign mods) vs is_moderator (chat moderation only).
ALTER TABLE vip_livestream.members
  ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;

-- Credential delivery tracking (Shopify webhook auto-send + --unsent-only backfill).
ALTER TABLE vip_livestream.members
  ADD COLUMN IF NOT EXISTS credentials_sent_at timestamptz;

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
  backup_youtube_video_id_1 text,
  backup_youtube_video_id_2 text,
  stream_start_utc timestamptz,
  is_live boolean NOT NULL DEFAULT false,
  setlist jsonb,
  description text,
  slow_mode_delay integer NOT NULL DEFAULT 10,
  pinned_message jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE vip_livestream.streams
  ADD COLUMN IF NOT EXISTS backup_youtube_video_id_1 text;

ALTER TABLE vip_livestream.streams
  ADD COLUMN IF NOT EXISTS backup_youtube_video_id_2 text;

ALTER TABLE vip_livestream.streams
  ADD COLUMN IF NOT EXISTS slow_mode_delay integer NOT NULL DEFAULT 10;

ALTER TABLE vip_livestream.streams
  ALTER COLUMN slow_mode_delay SET DEFAULT 10;

ALTER TABLE vip_livestream.streams
  ADD COLUMN IF NOT EXISTS pinned_message jsonb;

-- 3. Chat messages table
CREATE TABLE IF NOT EXISTS vip_livestream.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id uuid NOT NULL REFERENCES vip_livestream.streams(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES vip_livestream.members(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  content text,
  emoji text,
  is_muted boolean NOT NULL DEFAULT false,
  reactions jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT content_or_emoji CHECK (content IS NOT NULL OR emoji IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_stream_id_created ON vip_livestream.chat_messages(stream_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_member_stream_created ON vip_livestream.chat_messages(member_id, stream_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_unmuted_stream_created ON vip_livestream.chat_messages(stream_id, created_at DESC) WHERE is_muted = false;

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

-- 7. Setlists table (named, API-editable programmes / trackers)
-- Each row is one JSON document addressed by a stable slug, e.g.
--   'programme'        -> SetlistItem[] for the viewer programme on /watch
--   'belgium-tracker'  -> the full Belgium production tracker on /setlist
-- Both fall back to the code defaults (lib/default-setlist.ts,
-- lib/belgium-setlist.ts) when no row exists, so seeding is optional.
CREATE TABLE IF NOT EXISTS vip_livestream.setlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  data jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
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
ALTER TABLE vip_livestream.setlists ENABLE ROW LEVEL SECURITY;

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

CREATE POLICY "Service role full access on setlists" ON vip_livestream.setlists
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
-- Admin: yes (full access, can assign mods and test all moderation)
INSERT INTO vip_livestream.members (name, email, password_token, access_badges, display_name, is_admin, is_moderator, is_banned)
VALUES ('Test Viewer', 'test@musicalbasics.com', 'test', ARRAY['vip_member']::text[], 'Test Viewer', true, false, false)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  password_token = EXCLUDED.password_token,
  access_badges = EXCLUDED.access_badges,
  display_name = EXCLUDED.display_name,
  is_admin = true,
  is_banned = false;

-- ============================================================
-- Setlist
-- ============================================================
-- Resolution order for the viewer programme on /watch:
--   1. streams.setlist for the live stream, if non-empty (per-stream override)
--   2. vip_livestream.setlists row with slug 'programme', if present (global)
--   3. the code default in lib/default-setlist.ts
-- The full Belgium tracker on /setlist resolves to:
--   1. vip_livestream.setlists row with slug 'belgium-tracker', if present
--   2. the code default in lib/belgium-setlist.ts
--
-- Editing setlists via the agent API (Bearer AGENT_API_KEY):
--   GET    /api/agent/setlist                         -> list all stored rows
--   GET    /api/agent/setlist?slug=programme          -> one row (data + meta)
--   PUT    /api/agent/setlist  { slug, data }         -> upsert the JSON document
--   DELETE /api/agent/setlist  { slug }               -> revert to the code default
-- One stream's programme can still be overridden with:
--   PATCH /api/agent/stream  { "stream_id": "<uuid>", "setlist": [ ... ] }
