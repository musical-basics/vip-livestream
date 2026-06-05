-- Add backup stream sources for the livestream player.
-- Run this once in the Supabase SQL Editor if schema.sql has already been applied.

ALTER TABLE vip_livestream.streams
  ADD COLUMN IF NOT EXISTS backup_youtube_video_id_1 text;

ALTER TABLE vip_livestream.streams
  ADD COLUMN IF NOT EXISTS backup_youtube_video_id_2 text;
