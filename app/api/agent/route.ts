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
        'POST /api/agent/stream':  'Create a new stream. Body: { title, youtube_video_id, backup_youtube_video_id_1?, backup_youtube_video_id_2?, description?, setlist?, is_live? }. YouTube fields accept a URL or raw video ID.',
        'PATCH /api/agent/stream': 'Update a stream. Body: { stream_id, is_live?, youtube_video_id?, backup_youtube_video_id_1?, backup_youtube_video_id_2?, title?, description?, setlist?, stream_start_utc? }. Blank/null backup fields clear backups.',
        'DELETE /api/agent/stream': 'Delete a stream. Body: { stream_id }',
      },
      setlist: {
        'GET /api/agent/setlist':    "List stored setlist documents, or one with ?slug=. Slugs: 'programme' (viewer programme on /watch), 'belgium-tracker' (full production tracker on /setlist).",
        'PUT /api/agent/setlist':    "Create or overwrite a setlist document. Body: { slug, data }. For slug 'programme', data is a SetlistItem[] (each: { id, piece, composer, performer, composerYears?, duration?, notes?, category? } where category is 'solo'|'edm'|'trio'|'duet'). For slug 'belgium-tracker', data is the full tracker object.",
        'PATCH /api/agent/setlist':  'Alias for PUT (full-document upsert).',
        'DELETE /api/agent/setlist': 'Remove a stored document so the slug reverts to its code default. Body: { slug } (or ?slug=).',
      },
      members: {
        _roles: 'Two roles: is_admin (full access, can assign mods) and is_moderator (chat moderation only). They are independent flags; an admin can also moderate chat.',
        'GET /api/agent/members':    'List all members. Query: ?moderators_only=true, ?admins_only=true, ?banned=true|false',
        'POST /api/agent/members':   'Add a new member. Body: { name, email, is_moderator?, is_admin?, display_name?, access_badges? }. Badge IDs: vip_member, private_student, dreamplay_buyer.',
        'PATCH /api/agent/members':  'Update a member. Body: { member_id, display_name?, access_badges?, is_moderator?, is_admin?, is_banned?, regenerate_token? }. Set is_admin for full access, is_moderator for chat-only. NOTE: password rotation is disabled — regenerate_token does NOT change the password; it returns the existing login_url + assigned_password. To deliver credentials, run scripts/email-livestream-credentials.mjs.',
        'DELETE /api/agent/members': 'Remove a member. Body: { member_id }',
      },
      email: {
        'POST /api/agent/email-credentials': "Email the livestream login credentials (auto-login link + email/password) to one or more existing members. Body: { member_id?, email?, emails?: string[] } (provide at least one). Reuses each member's stored password (no rotation). Use for 'my password doesn't work' / resend-invite requests.",
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
