-- ============================================================
-- VIP Livestream — Supabase Database Schema
-- Run this in the Supabase SQL Editor
-- ============================================================

-- 1. Members table
CREATE TABLE IF NOT EXISTS public.members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text UNIQUE NOT NULL,
  password_token text UNIQUE NOT NULL,
  display_name text,
  is_moderator boolean NOT NULL DEFAULT false,
  is_banned boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Streams table
CREATE TABLE IF NOT EXISTS public.streams (
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
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id uuid NOT NULL REFERENCES public.streams(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  content text,
  emoji text,
  is_muted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT content_or_emoji CHECK (content IS NOT NULL OR emoji IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_stream_id_created ON public.chat_messages(stream_id, created_at DESC);

-- 4. Member timeouts table
CREATE TABLE IF NOT EXISTS public.member_timeouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  stream_id uuid NOT NULL REFERENCES public.streams(id) ON DELETE CASCADE,
  muted_by uuid NOT NULL REFERENCES public.members(id),
  timeout_until timestamptz, -- NULL = permanent
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_member_timeouts_member ON public.member_timeouts(member_id, stream_id);

-- 5. Comments table (guestbook / leave-a-note)
CREATE TABLE IF NOT EXISTS public.comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id uuid NOT NULL REFERENCES public.streams(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  content text NOT NULL,
  is_approved boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comments_stream ON public.comments(stream_id, created_at);

-- 6. Tips table
CREATE TABLE IF NOT EXISTS public.tips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id uuid NOT NULL REFERENCES public.streams(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  stripe_session_id text UNIQUE,
  message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- Row Level Security (RLS)
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.streams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_timeouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tips ENABLE ROW LEVEL SECURITY;

-- Members: only service role can read/write (all API calls use service role)
-- Realtime subscriptions use anon key but we use Broadcast (not DB changes) for chat
-- so no anon policies needed for members table

-- Chat messages: allow anon read of non-muted messages for Realtime
-- (Realtime Broadcast doesn't use DB, so these policies are for direct queries)
CREATE POLICY "Service role full access on members" ON public.members
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on streams" ON public.streams
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on chat_messages" ON public.chat_messages
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on member_timeouts" ON public.member_timeouts
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on comments" ON public.comments
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on tips" ON public.tips
  FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- Enable Realtime for Broadcast
-- ============================================================
-- In Supabase dashboard: Database > Replication > enable for chat_messages
-- Or run:
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.streams;

-- ============================================================
-- Example: Insert a test stream
-- ============================================================
-- INSERT INTO public.streams (title, youtube_video_id, is_live, description)
-- VALUES ('VIP Piano Recital — June 2026', 'YOUR_YOUTUBE_VIDEO_ID', false, 'An intimate evening of classical piano.');
