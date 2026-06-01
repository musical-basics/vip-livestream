import { NextRequest } from 'next/server'
import { verifyAgentKey, agentUnauthorized } from '@/lib/agent-auth'
import { createServiceClient } from '@/lib/supabase-server'

/**
 * GET /api/agent/status
 * Returns high-level platform status for agent awareness.
 */
export async function GET(request: NextRequest) {
  if (!verifyAgentKey(request)) return agentUnauthorized()

  const supabase = createServiceClient()

  const [streamRes, membersRes, messagesRes] = await Promise.all([
    supabase
      .from('streams')
      .select('id, title, is_live, youtube_video_id, stream_start_utc, created_at')
      .order('created_at', { ascending: false })
      .limit(1)
      .single(),
    supabase
      .from('members')
      .select('id, name, email, is_moderator, is_banned, created_at'),
    supabase
      .from('chat_messages')
      .select('id', { count: 'exact', head: true }),
  ])

  const stream = streamRes.data
  const members = membersRes.data ?? []

  return Response.json({
    ok: true,
    stream: stream
      ? {
          id: stream.id,
          title: stream.title,
          is_live: stream.is_live,
          youtube_video_id: stream.youtube_video_id,
          stream_start_utc: stream.stream_start_utc,
        }
      : null,
    members: {
      total: members.length,
      moderators: members.filter(m => m.is_moderator).length,
      banned: members.filter(m => m.is_banned).length,
    },
    total_messages: messagesRes.count ?? 0,
    timestamp: new Date().toISOString(),
  })
}
