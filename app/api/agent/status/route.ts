import { NextRequest } from 'next/server'
import { verifyAgentKey, agentUnauthorized } from '@/lib/agent-auth'
import { MEMBER_BADGES, normalizeMemberBadges } from '@/lib/member-badges'
import { createServiceClient } from '@/lib/supabase-server'

/**
 * GET /api/agent/status
 * Returns high-level platform status for agent awareness.
 */
export async function GET(request: NextRequest) {
  if (!verifyAgentKey(request)) return agentUnauthorized()

  const supabase = createServiceClient()

  const [liveStreamRes, membersRes, messagesRes] = await Promise.all([
    supabase
        .from('streams')
        .select('*')
      .eq('is_live', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('members')
      .select('*'),
    supabase
      .from('chat_messages')
      .select('id', { count: 'exact', head: true }),
  ])

  const newestStreamRes = liveStreamRes.data
    ? { data: null }
    : await supabase
          .from('streams')
          .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

  const stream = liveStreamRes.data ?? newestStreamRes.data
  const members = membersRes.data ?? []
  const badgeCounts = Object.fromEntries(MEMBER_BADGES.map((badge) => [badge.id, 0]))
  members.forEach((member) => {
    normalizeMemberBadges(member.access_badges).forEach((badgeId) => {
      badgeCounts[badgeId] = (badgeCounts[badgeId] ?? 0) + 1
    })
  })

  return Response.json({
    ok: true,
    stream: stream
      ? {
          id: stream.id,
          title: stream.title,
            is_live: stream.is_live,
            youtube_video_id: stream.youtube_video_id,
          backup_youtube_video_id_1: stream.backup_youtube_video_id_1 ?? null,
          backup_youtube_video_id_2: stream.backup_youtube_video_id_2 ?? null,
            stream_start_utc: stream.stream_start_utc,
        }
      : null,
    members: {
      total: members.length,
      admins: members.filter(m => m.is_admin).length,
      moderators: members.filter(m => m.is_moderator).length,
      banned: members.filter(m => m.is_banned).length,
      badges: badgeCounts,
    },
    total_messages: messagesRes.count ?? 0,
    timestamp: new Date().toISOString(),
  })
}
