import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { fetchYouTubeVideoMetadata } from '@/lib/youtube-metadata'
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

export async function GET(request: NextRequest) {
  // Verify Vercel Cron Secret if configured
  const authHeader = request.headers.get('Authorization')
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return new Response('Unauthorized', { status: 401 })
  }

  const supabase = createServiceClient()

  // Find the current live stream
  const { data: stream, error: fetchError } = await supabase
    .from('streams')
    .select('*')
    .eq('is_live', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 })
  }

  if (!stream) {
    return NextResponse.json({ ok: true, message: 'No active live stream to sync.' })
  }

  // Fetch real-time status from YouTube (runs once per minute in the background)
  const metadata = await fetchYouTubeVideoMetadata(stream.youtube_video_id)

  if (metadata.broadcastStatus === 'ended') {
    console.log(`[Cron Sync] Stream ${stream.id} ended on YouTube. Deactivating in database.`)

    // Deactivate the stream in the database
    const { error: updateError } = await supabase
      .from('streams')
      .update({ is_live: false })
      .eq('id', stream.id)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    // Broadcast change so current viewers receive stream_ended
    await broadcastStreamStatus(stream.id, false)

    return NextResponse.json({
      ok: true,
      message: 'Detected ended YouTube stream. Marked offline in DB.',
      stream_id: stream.id,
      youtube_video_id: stream.youtube_video_id,
    })
  }

  return NextResponse.json({
    ok: true,
    message: 'Active stream checked.',
    broadcast_status: metadata.broadcastStatus,
    stream_id: stream.id,
    youtube_video_id: stream.youtube_video_id,
  })
}
