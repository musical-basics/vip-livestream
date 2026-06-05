-- ============================================================
-- Chat performance indexes
-- Run this ONCE in the Supabase SQL editor.
-- Safe to re-run (idempotent).
-- ============================================================

-- Required by moderator slow mode on existing databases.
ALTER TABLE vip_livestream.streams
  ADD COLUMN IF NOT EXISTS slow_mode_delay integer NOT NULL DEFAULT 10;

ALTER TABLE vip_livestream.streams
  ALTER COLUMN slow_mode_delay SET DEFAULT 10;

UPDATE vip_livestream.streams
SET slow_mode_delay = 10;

-- Keeps the per-member send throttle fast as chat history grows.
CREATE INDEX IF NOT EXISTS idx_chat_messages_member_stream_created
  ON vip_livestream.chat_messages(member_id, stream_id, created_at DESC);

-- Keeps /watch initial chat load and "Load earlier messages" fast.
CREATE INDEX IF NOT EXISTS idx_chat_messages_unmuted_stream_created
  ON vip_livestream.chat_messages(stream_id, created_at DESC)
  WHERE is_muted = false;
