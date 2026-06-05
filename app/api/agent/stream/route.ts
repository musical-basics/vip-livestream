import { NextRequest } from 'next/server'
import { verifyAgentKey, agentUnauthorized } from '@/lib/agent-auth'
import { createServiceClient } from '@/lib/supabase-server'
import { extractYouTubeVideoId } from '@/lib/youtube'
import { createClient } from '@supabase/supabase-js'

async function broadcastStreamStatus(streamId: string, isLive: boolean) {
  const realtimeClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const payload = { stream_id: streamId, is_live: isLive }
  const event = isLive ? 'stream_live' : 'stream_ended'

  await Promise.all(
    [`stream:${streamId}`, `stream-status:${streamId}`, 'stream-status'].map((topic) =>
      realtimeClient.channel(topic).send({
        type: 'broadcast',
        event,
        payload,
      })
    )
  )
}

/**
 * GET /api/agent/stream
 * List all streams (most recent first).
 */
export async function GET(request: NextRequest) {
  if (!verifyAgentKey(request)) return agentUnauthorized()

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('streams')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ streams: data })
}

/**
 * POST /api/agent/stream
 * Create a new stream.
 * Body: { title, youtube_video_id, description?, setlist?, is_live? }
 * youtube_video_id may be a YouTube URL or raw video ID.
 */
export async function POST(request: NextRequest) {
  if (!verifyAgentKey(request)) return agentUnauthorized()

  const body = await request.json()
  const { title, youtube_video_id, description, setlist, is_live } = body
  const videoId = extractYouTubeVideoId(youtube_video_id ?? '')

  if (!title || !videoId) {
    return Response.json({ error: 'title and valid youtube_video_id are required' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { data: stream, error } = await supabase
    .from('streams')
    .insert({
      title,
      youtube_video_id: videoId,
      description,
      setlist,
      is_live: is_live ?? false,
      ...(is_live === true && { stream_start_utc: new Date().toISOString() }),
    })
    .select()
    .single()

  if (error || !stream) {
    return Response.json({ error: error?.message ?? 'Failed to create stream' }, { status: 500 })
  }

  if (is_live === true) {
    await supabase
      .from('streams')
      .update({ is_live: false })
      .neq('id', stream.id)
      .eq('is_live', true)
    await broadcastStreamStatus(stream.id, true)
  }

  return Response.json({ ok: true, stream }, { status: 201 })
}

/**
 * PATCH /api/agent/stream
 * Update a stream. Can go live, end stream, change video, etc.
 * Body: { stream_id, is_live?, youtube_video_id?, title?, description?, setlist?, stream_start_utc? }
 * youtube_video_id may be a YouTube URL or raw video ID.
 */
export async function PATCH(request: NextRequest) {
  if (!verifyAgentKey(request)) return agentUnauthorized()

  const body = await request.json()
  const { stream_id, ...rest } = body

  if (!stream_id) return Response.json({ error: 'stream_id is required' }, { status: 400 })

  const allowed = ['is_live', 'youtube_video_id', 'title', 'description', 'setlist', 'stream_start_utc']
  const update: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in rest) update[key] = rest[key]
  }

  if ('youtube_video_id' in update) {
    const videoId = extractYouTubeVideoId(String(update.youtube_video_id ?? ''))
    if (!videoId) return Response.json({ error: 'valid youtube_video_id is required' }, { status: 400 })
    update.youtube_video_id = videoId
  }

  // Auto-stamp stream_start_utc when going live
  if (update.is_live === true && !update.stream_start_utc) {
    update.stream_start_utc = new Date().toISOString()
  }

  const supabase = createServiceClient()
  const { data: stream, error } = await supabase
    .from('streams')
    .update(update)
    .eq('id', stream_id)
    .select()
    .single()

  if (error || !stream) {
    return Response.json({ error: error?.message ?? 'Failed to update stream' }, { status: 500 })
  }

  if (update.is_live === true) {
    await supabase
      .from('streams')
      .update({ is_live: false })
      .neq('id', stream_id)
      .eq('is_live', true)
  }

  // Broadcast go-live / stream-ended events to all connected clients
  if ('is_live' in update) {
    await broadcastStreamStatus(stream_id, update.is_live === true)
  }

  return Response.json({ ok: true, stream })
}

/**
 * DELETE /api/agent/stream
 * Delete a stream (and all associated data via CASCADE).
 * Body: { stream_id }
 */
export async function DELETE(request: NextRequest) {
  if (!verifyAgentKey(request)) return agentUnauthorized()

  const { stream_id } = await request.json()
  if (!stream_id) return Response.json({ error: 'stream_id is required' }, { status: 400 })

  const supabase = createServiceClient()
  const { error } = await supabase.from('streams').delete().eq('id', stream_id)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true, deleted: stream_id })
}
