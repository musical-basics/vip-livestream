-- ============================================================
-- SQL Migration to add Top Chatters Leaderboard RPC Function
-- Run this in your Supabase SQL Editor
-- ============================================================

CREATE OR REPLACE FUNCTION vip_livestream.get_top_chatters(p_stream_id uuid, p_limit integer DEFAULT 20)
RETURNS TABLE (
  member_id uuid,
  display_name text,
  name text,
  name_color text,
  access_badges text[],
  is_moderator boolean,
  message_count bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cm.member_id,
    coalesce(m.display_name, m.name) as display_name,
    m.name,
    m.name_color,
    m.access_badges,
    m.is_moderator,
    COUNT(cm.id) as message_count
  FROM vip_livestream.chat_messages cm
  JOIN vip_livestream.members m ON cm.member_id = m.id
  WHERE cm.stream_id = p_stream_id
    AND cm.is_muted = false
    AND m.is_admin = false
    AND m.is_banned = false
    AND (cm.content IS NULL OR cm.content NOT LIKE '[System]%')
  GROUP BY cm.member_id, m.display_name, m.name, m.name_color, m.access_badges, m.is_moderator
  ORDER BY message_count DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions for RPC calls
GRANT EXECUTE ON FUNCTION vip_livestream.get_top_chatters(uuid, integer) TO anon, authenticated, service_role;
