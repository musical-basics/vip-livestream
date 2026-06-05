import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getVerifiedLiveStream } from '@/lib/live-stream'
import { createServiceClient } from '@/lib/supabase-server'

export async function GET() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()

  const stream = await getVerifiedLiveStream(supabase)

  if (!stream) {
    return NextResponse.json({ is_live: false })
  }

  const serverNow = new Date().toISOString()
  let offsetSeconds = 0

  if (stream.stream_start_utc) {
    const startMs = new Date(stream.stream_start_utc).getTime()
    const nowMs = new Date(serverNow).getTime()
    offsetSeconds = Math.max(0, Math.floor((nowMs - startMs) / 1000))
  }

    return NextResponse.json({
      is_live: true,
      stream_id: stream.id,
      youtube_video_id: stream.youtube_video_id,
    backup_youtube_video_id_1: stream.backup_youtube_video_id_1 ?? null,
    backup_youtube_video_id_2: stream.backup_youtube_video_id_2 ?? null,
      stream_start_utc: stream.stream_start_utc,
      server_now: serverNow,
    offset_seconds: offsetSeconds,
  })
}
