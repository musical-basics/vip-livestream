import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { isAdmin } from '@/lib/roles'
import { createServiceClient } from '@/lib/supabase-server'
import { extractYouTubeVideoId } from '@/lib/youtube'
import { createClient as createBrowserClient } from '@supabase/supabase-js'

async function broadcastStreamStatus(
  streamId: string,
  isLive: boolean,
  event = isLive ? 'stream_live' : 'stream_ended'
) {
  const realtimeClient = createBrowserClient(
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

// POST — create a new stream
export async function POST(request: NextRequest) {
  const member = await getSession()
  if (!isAdmin(member)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const {
    title,
    youtube_video_id,
    backup_youtube_video_id_1,
    backup_youtube_video_id_2,
    description,
    setlist,
  } = await request.json()
  const videoId = extractYouTubeVideoId(youtube_video_id ?? '')
  const backupVideoId1 = parseOptionalVideoId(backup_youtube_video_id_1)
  const backupVideoId2 = parseOptionalVideoId(backup_youtube_video_id_2)

  if (!title || !videoId) {
    return NextResponse.json({ error: 'title and valid youtube_video_id required' }, { status: 400 })
  }
  if (!backupVideoId1.isValid) {
    return NextResponse.json({ error: 'valid backup_youtube_video_id_1 required' }, { status: 400 })
  }
  if (!backupVideoId2.isValid) {
    return NextResponse.json({ error: 'valid backup_youtube_video_id_2 required' }, { status: 400 })
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
      is_live: false,
    })
    .select()
    .single()

  if (error || !stream) return NextResponse.json({ error: 'Failed to create' }, { status: 500 })
  return NextResponse.json({ stream })
}

// PATCH — update stream (go live, end stream, update details, or manual refresh broadcast)
export async function PATCH(request: NextRequest) {
  const member = await getSession()
  if (!isAdmin(member)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const {
    stream_id,
    is_live,
    stream_start_utc,
    youtube_video_id,
    backup_youtube_video_id_1,
    backup_youtube_video_id_2,
    title,
    setlist,
    force_refresh,
  } = await request.json()

  if (!stream_id) return NextResponse.json({ error: 'stream_id required' }, { status: 400 })

  const supabase = createServiceClient()

  // Handle manual "Force Refresh Viewers"
  if (force_refresh === true) {
    const { data: stream, error } = await supabase
      .from('streams')
      .select('*')
      .eq('id', stream_id)
      .single()

    if (error || !stream) {
      return NextResponse.json({ error: 'Stream not found' }, { status: 404 })
    }

    // Broadcast stream_updated to trigger all connected clients to reload/refresh page data
    await broadcastStreamStatus(stream_id, stream.is_live, 'stream_updated')
    return NextResponse.json({ ok: true, stream })
  }

  const update: {
    is_live?: boolean
    stream_start_utc?: string | null
      youtube_video_id?: string
    backup_youtube_video_id_1?: string | null
    backup_youtube_video_id_2?: string | null
      title?: string
      setlist?: unknown
    } = {}
  if (is_live !== undefined) update.is_live = is_live
  if (stream_start_utc !== undefined) update.stream_start_utc = stream_start_utc
  if (is_live === true && stream_start_utc === undefined) {
    update.stream_start_utc = new Date().toISOString()
  }
  if (youtube_video_id !== undefined) {
    const videoId = extractYouTubeVideoId(youtube_video_id)
    if (!videoId) return NextResponse.json({ error: 'valid youtube_video_id required' }, { status: 400 })
    update.youtube_video_id = videoId
  }
  if (backup_youtube_video_id_1 !== undefined) {
    const backupVideoId = parseOptionalVideoId(backup_youtube_video_id_1)
    if (!backupVideoId.isValid) {
      return NextResponse.json({ error: 'valid backup_youtube_video_id_1 required' }, { status: 400 })
    }
    update.backup_youtube_video_id_1 = backupVideoId.videoId
  }
  if (backup_youtube_video_id_2 !== undefined) {
    const backupVideoId = parseOptionalVideoId(backup_youtube_video_id_2)
    if (!backupVideoId.isValid) {
      return NextResponse.json({ error: 'valid backup_youtube_video_id_2 required' }, { status: 400 })
    }
    update.backup_youtube_video_id_2 = backupVideoId.videoId
  }
  if (title !== undefined) update.title = title
  if (setlist !== undefined) update.setlist = setlist

  const { data: stream, error } = await supabase
    .from('streams')
    .update(update)
    .eq('id', stream_id)
    .select()
    .single()

  if (error || !stream) return NextResponse.json({ error: 'Failed to update' }, { status: 500 })

  // Only one stream should be active at a time. End prior test/live records.
  if (is_live === true) {
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

  // Broadcast stream changes so viewers refresh without touching the browser.
  if (is_live !== undefined) {
    await broadcastStreamStatus(stream_id, is_live)
  } else if (Object.keys(update).length > 0) {
    await broadcastStreamStatus(stream_id, stream.is_live, 'stream_updated')
  }

  return NextResponse.json({ stream })
}
