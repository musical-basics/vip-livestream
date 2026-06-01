import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase-server'

export async function GET() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()

  // Get the active stream
  const { data: stream, error } = await supabase
    .from('streams')
    .select('id, stream_start_utc, is_live, youtube_video_id')
    .eq('is_live', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (error || !stream) {
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
    stream_start_utc: stream.stream_start_utc,
    server_now: serverNow,
    offset_seconds: offsetSeconds,
  })
}
