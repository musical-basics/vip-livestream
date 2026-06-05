-- ============================================================
-- Chat performance indexes
-- Run this ONCE in the Supabase SQL editor.
-- Safe to re-run (idempotent).
-- ============================================================

-- Keeps the per-member send throttle fast as chat history grows.
CREATE INDEX IF NOT EXISTS idx_chat_messages_member_stream_created
  ON vip_livestream.chat_messages(member_id, stream_id, created_at DESC);

-- Keeps /watch initial chat load and "Load earlier messages" fast.
CREATE INDEX IF NOT EXISTS idx_chat_messages_unmuted_stream_created
  ON vip_livestream.chat_messages(stream_id, created_at DESC)
  WHERE is_muted = false;
