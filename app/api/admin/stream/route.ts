import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
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

// POST — create a new stream
export async function POST(request: NextRequest) {
  const member = await getSession()
  if (!member?.is_moderator) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { title, youtube_video_id, description, setlist } = await request.json()
  const videoId = extractYouTubeVideoId(youtube_video_id ?? '')

  if (!title || !videoId) {
    return NextResponse.json({ error: 'title and valid youtube_video_id required' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { data: stream, error } = await supabase
    .from('streams')
    .insert({ title, youtube_video_id: videoId, description, setlist, is_live: false })
    .select()
    .single()

  if (error || !stream) return NextResponse.json({ error: 'Failed to create' }, { status: 500 })
  return NextResponse.json({ stream })
}

// PATCH — update stream (go live, end stream, update details)
export async function PATCH(request: NextRequest) {
  const member = await getSession()
  if (!member?.is_moderator) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { stream_id, is_live, stream_start_utc, youtube_video_id, title, setlist } = await request.json()

  if (!stream_id) return NextResponse.json({ error: 'stream_id required' }, { status: 400 })

  const supabase = createServiceClient()
  const update: {
    is_live?: boolean
    stream_start_utc?: string | null
    youtube_video_id?: string
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
    await supabase
      .from('streams')
      .update({ is_live: false })
      .neq('id', stream_id)
      .eq('is_live', true)
  }

  // Broadcast stream changes so viewers refresh without touching the browser.
  if (is_live !== undefined) {
    await broadcastStreamStatus(stream_id, is_live)
  } else if (Object.keys(update).length > 0) {
    await broadcastStreamStatus(stream_id, stream.is_live, 'stream_updated')
  }

  return NextResponse.json({ stream })
}
