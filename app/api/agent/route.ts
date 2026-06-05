import { NextRequest } from 'next/server'
import { verifyAgentKey, agentUnauthorized } from '@/lib/agent-auth'
import { MEMBER_BADGES } from '@/lib/member-badges'

/**
 * GET /api/agent
 * Returns the full API reference for external AI agents.
 */
export async function GET(request: NextRequest) {
  if (!verifyAgentKey(request)) return agentUnauthorized()

  const base = process.env.NEXT_PUBLIC_APP_URL || 'https://vip.musicalbasics.com'

  return Response.json({
    name: 'VIP Livestream Agent API',
    version: '1.0.0',
    base_url: `${base}/api/agent`,
    auth: 'Bearer <AGENT_API_KEY> in Authorization header',
    endpoints: {
      status: {
        'GET /api/agent/status': 'Current platform status (active stream, member count, message count)',
      },
      stream: {
        'GET /api/agent/stream':   'List all streams (most recent first)',
        'POST /api/agent/stream':  'Create a new stream. Body: { title, youtube_video_id, description?, setlist?, is_live? }. youtube_video_id accepts a YouTube URL or raw video ID.',
        'PATCH /api/agent/stream': 'Update a stream. Body: { stream_id, is_live?, youtube_video_id?, title?, description?, setlist?, stream_start_utc? }. youtube_video_id accepts a YouTube URL or raw video ID.',
        'DELETE /api/agent/stream': 'Delete a stream. Body: { stream_id }',
      },
      members: {
        'GET /api/agent/members':    'List all members. Query: ?moderators_only=true|false, ?banned=true|false',
        'POST /api/agent/members':   'Add a new member. Body: { name, email, is_moderator?, display_name?, access_badges? }. Badge IDs: vip_member, private_student, dreamplay_buyer.',
        'PATCH /api/agent/members':  'Update a member. Body: { member_id, display_name?, access_badges?, is_moderator?, is_banned?, regenerate_token? }. Regeneration returns login_url and assigned_password.',
        'DELETE /api/agent/members': 'Remove a member. Body: { member_id }',
      },
      messages: {
        'GET /api/agent/messages':   'Get chat messages. Query: ?stream_id=<uuid>&limit=50&include_muted=true',
        'PATCH /api/agent/messages': 'Mute or unmute a message. Body: { message_id, stream_id, is_muted: true|false }',
        'DELETE /api/agent/messages': 'Delete a chat message. Body: { message_id, stream_id }',
      },
      moderation: {
        'POST /api/agent/moderation':   'Issue a timeout or permanent mute. Body: { action: "timeout"|"mute", member_id, stream_id, minutes? (null=permanent) }',
        'DELETE /api/agent/moderation': 'Clear all active timeouts for a member. Body: { member_id, stream_id }',
      },
      comments: {
        'GET /api/agent/comments':   'Get comments. Query: ?stream_id=<uuid>&include_hidden=true',
        'PATCH /api/agent/comments': 'Approve or hide a comment. Body: { comment_id, is_approved: true|false }',
      },
      tips: {
        'GET /api/agent/tips': 'Get tips. Query: ?stream_id=<uuid>',
      },
      broadcast: {
        'POST /api/agent/broadcast': 'Send a realtime event to all connected clients. Body: { stream_id, event, payload }',
      },
    },
    member_badges: MEMBER_BADGES,
    broadcast_events: [
      'new_message', 'mute_message', 'delete_message', 'member_muted', 'stream_live',
      'stream_ended', 'stream_updated', 'tip_received', 'announcement',
    ],
  })
}
