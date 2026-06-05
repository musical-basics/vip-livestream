import { NextRequest } from 'next/server'
import { verifyAgentKey, agentUnauthorized } from '@/lib/agent-auth'
import { createServiceClient } from '@/lib/supabase-server'
import { extractYouTubeVideoId } from '@/lib/youtube'
import { createClient } from '@supabase/supabase-js'

async function broadcastStreamStatus(
  streamId: string,
  isLive: boolean,
  event = isLive ? 'stream_live' : 'stream_ended'
) {
  const realtimeClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const payload = { stream_id: streamId, is_live: isLive }

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

function parseOptionalVideoId(value: unknown) {
  const input = typeof value === 'string' ? value.trim() : ''
  if (!input) return { videoId: null, isValid: true }

  const videoId = extractYouTubeVideoId(input)
  return { videoId: videoId || null, isValid: !!videoId }
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
 * Body: { title, youtube_video_id, backup_youtube_video_id_1?, backup_youtube_video_id_2?, description?, setlist?, is_live? }
 * YouTube IDs may be full URLs or raw video IDs.
 */
export async function POST(request: NextRequest) {
  if (!verifyAgentKey(request)) return agentUnauthorized()

  const body = await request.json()
  const {
    title,
    youtube_video_id,
    backup_youtube_video_id_1,
    backup_youtube_video_id_2,
    description,
    setlist,
    is_live,
  } = body
  const videoId = extractYouTubeVideoId(youtube_video_id ?? '')
  const backupVideoId1 = parseOptionalVideoId(backup_youtube_video_id_1)
  const backupVideoId2 = parseOptionalVideoId(backup_youtube_video_id_2)

  if (!title || !videoId) {
    return Response.json({ error: 'title and valid youtube_video_id are required' }, { status: 400 })
  }
  if (!backupVideoId1.isValid) {
    return Response.json({ error: 'valid backup_youtube_video_id_1 is required' }, { status: 400 })
  }
  if (!backupVideoId2.isValid) {
    return Response.json({ error: 'valid backup_youtube_video_id_2 is required' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { data: stream, error } = await supabase
    .from('streams')
    .insert({
        title,
        youtube_video_id: videoId,
      ...(backupVideoId1.videoId && { backup_youtube_video_id_1: backupVideoId1.videoId }),
      ...(backupVideoId2.videoId && { backup_youtube_video_id_2: backupVideoId2.videoId }),
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
    // Find prior live streams so we can broadcast ended to their specific channels
    const { data: priorLiveStreams } = await supabase
      .from('streams')
      .select('id')
      .eq('is_live', true)
      .neq('id', stream.id)

    // Deactivate them
    await supabase
      .from('streams')
      .update({ is_live: false })
      .neq('id', stream.id)
      .eq('is_live', true)

    // Broadcast stream_ended to the prior streams' specific channels so their viewers reload
    if (priorLiveStreams && priorLiveStreams.length > 0) {
      for (const prior of priorLiveStreams) {
        await broadcastStreamStatus(prior.id, false, 'stream_ended')
      }
    }

    await broadcastStreamStatus(stream.id, true)
  }

  return Response.json({ ok: true, stream }, { status: 201 })
}

/**
 * PATCH /api/agent/stream
 * Update a stream. Can go live, end stream, change video, etc.
 * Body: { stream_id, is_live?, youtube_video_id?, backup_youtube_video_id_1?, backup_youtube_video_id_2?, title?, description?, setlist?, stream_start_utc? }
 * YouTube IDs may be full URLs or raw video IDs.
 */
export async function PATCH(request: NextRequest) {
  if (!verifyAgentKey(request)) return agentUnauthorized()

  const body = await request.json()
  const { stream_id, ...rest } = body

  if (!stream_id) return Response.json({ error: 'stream_id is required' }, { status: 400 })

  const allowed = [
    'is_live',
    'youtube_video_id',
    'backup_youtube_video_id_1',
    'backup_youtube_video_id_2',
    'title',
    'description',
    'setlist',
    'stream_start_utc',
  ]
  const update: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in rest) update[key] = rest[key]
  }

  if ('youtube_video_id' in update) {
    const videoId = extractYouTubeVideoId(String(update.youtube_video_id ?? ''))
    if (!videoId) return Response.json({ error: 'valid youtube_video_id is required' }, { status: 400 })
    update.youtube_video_id = videoId
  }
  if ('backup_youtube_video_id_1' in update) {
    const backupVideoId = parseOptionalVideoId(update.backup_youtube_video_id_1)
    if (!backupVideoId.isValid) {
      return Response.json({ error: 'valid backup_youtube_video_id_1 is required' }, { status: 400 })
    }
    update.backup_youtube_video_id_1 = backupVideoId.videoId
  }
  if ('backup_youtube_video_id_2' in update) {
    const backupVideoId = parseOptionalVideoId(update.backup_youtube_video_id_2)
    if (!backupVideoId.isValid) {
      return Response.json({ error: 'valid backup_youtube_video_id_2 is required' }, { status: 400 })
    }
    update.backup_youtube_video_id_2 = backupVideoId.videoId
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
    // Find prior live streams so we can broadcast ended to their specific channels
    const { data: priorLiveStreams } = await supabase
      .from('streams')
      .select('id')
      .eq('is_live', true)
      .neq('id', stream_id)

    // Deactivate them
    await supabase
      .from('streams')
      .update({ is_live: false })
      .neq('id', stream_id)
      .eq('is_live', true)

    // Broadcast stream_ended to the prior streams' specific channels so their viewers reload
    if (priorLiveStreams && priorLiveStreams.length > 0) {
      for (const prior of priorLiveStreams) {
        await broadcastStreamStatus(prior.id, false, 'stream_ended')
      }
    }
  }

  // Broadcast stream changes so connected viewers refresh automatically.
  if ('is_live' in update) {
    await broadcastStreamStatus(stream_id, update.is_live === true)
  } else if (Object.keys(update).length > 0) {
    await broadcastStreamStatus(stream_id, stream.is_live, 'stream_updated')
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
