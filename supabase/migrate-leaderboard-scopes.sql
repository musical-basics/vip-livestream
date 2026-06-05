-- ============================================================
-- SQL Migration to unify Leaderboard scopes (Current, Weekly, Monthly, All-time)
-- Run this in your Supabase SQL Editor
-- ============================================================

DROP FUNCTION IF EXISTS vip_livestream.get_top_chatters(uuid, integer);
DROP FUNCTION IF EXISTS vip_livestream.get_all_time_top_chatters(integer);

CREATE OR REPLACE FUNCTION vip_livestream.get_scoped_top_chatters(
  p_scope text,
  p_stream_id uuid DEFAULT null,
  p_limit integer DEFAULT 20
)
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
  IF p_scope = 'current' THEN
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
      -- Exclude system messages from the chatter leaderboard
      AND NOT (cm.content LIKE '[System]%')
    GROUP BY cm.member_id, m.display_name, m.name, m.name_color, m.access_badges, m.is_moderator
    ORDER BY message_count DESC
    LIMIT p_limit;
    
  ELSIF p_scope = 'weekly' THEN
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
    WHERE cm.created_at >= now() - interval '7 days'
      AND cm.is_muted = false
      AND m.is_admin = false
      AND m.is_banned = false
      -- Exclude system messages
      AND NOT (cm.content LIKE '[System]%')
    GROUP BY cm.member_id, m.display_name, m.name, m.name_color, m.access_badges, m.is_moderator
    ORDER BY message_count DESC
    LIMIT p_limit;
    
  ELSIF p_scope = 'monthly' THEN
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
    WHERE cm.created_at >= now() - interval '30 days'
      AND cm.is_muted = false
      AND m.is_admin = false
      AND m.is_banned = false
      -- Exclude system messages
      AND NOT (cm.content LIKE '[System]%')
    GROUP BY cm.member_id, m.display_name, m.name, m.name_color, m.access_badges, m.is_moderator
    ORDER BY message_count DESC
    LIMIT p_limit;
    
  ELSE -- all-time
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
    WHERE cm.is_muted = false
      AND m.is_admin = false
      AND m.is_banned = false
      -- Exclude system messages
      AND NOT (cm.content LIKE '[System]%')
    GROUP BY cm.member_id, m.display_name, m.name, m.name_color, m.access_badges, m.is_moderator
    ORDER BY message_count DESC
    LIMIT p_limit;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION vip_livestream.get_scoped_top_chatters(text, uuid, integer) TO anon, authenticated, service_role;
