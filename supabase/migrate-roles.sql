-- ============================================================
-- Roles migration: add is_admin and assign the two-tier roles
-- Run this ONCE in the Supabase SQL editor.
-- Safe to re-run (idempotent).
--
--   is_admin     = full access, can assign moderators
--   is_moderator = chat moderation only
--   (both false) = regular member
-- ============================================================

-- 1) Add the column (no-op if it already exists)
ALTER TABLE vip_livestream.members
  ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;

-- 2) Admins: full access
UPDATE vip_livestream.members
   SET is_admin = true, is_moderator = false
 WHERE lower(email) IN (
   'test@musicalbasics.com',   -- Test Viewer
   'lionel@example.com'        -- Lionel
 );

-- 3) Moderators: chat moderation only
UPDATE vip_livestream.members
   SET is_moderator = true, is_admin = false
 WHERE lower(email) IN (
   'louise_everet93@yahoo.com', -- Patricia Louise Everett
   'angenalaschka@gmail.com',   -- Angena Laschka
   'naomibeharry@gmail.com'     -- Naomi Beharry
 );

-- 4) Everyone else: regular member
UPDATE vip_livestream.members
   SET is_admin = false, is_moderator = false
 WHERE lower(email) NOT IN (
   'test@musicalbasics.com',
   'lionel@example.com',
   'louise_everet93@yahoo.com',
   'angenalaschka@gmail.com',
   'naomibeharry@gmail.com'
 );

-- 5) Verify
SELECT
  CASE WHEN is_admin THEN 'admin' WHEN is_moderator THEN 'mod' ELSE 'regular' END AS role,
  name, email
FROM vip_livestream.members
ORDER BY is_admin DESC, is_moderator DESC, name;
