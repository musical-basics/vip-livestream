import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase-server'
import { createClient as createBrowserClient } from '@supabase/supabase-js'

// POST — create a new stream
export async function POST(request: NextRequest) {
  const member = await getSession()
  if (!member?.is_moderator) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { title, youtube_video_id, description, setlist } = await request.json()

  if (!title || !youtube_video_id) {
    return NextResponse.json({ error: 'title and youtube_video_id required' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { data: stream, error } = await supabase
    .from('streams')
    .insert({ title, youtube_video_id, description, setlist, is_live: false })
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
  const update: Record<string, any> = {}
  if (is_live !== undefined) update.is_live = is_live
  if (stream_start_utc !== undefined) update.stream_start_utc = stream_start_utc
  if (youtube_video_id !== undefined) update.youtube_video_id = youtube_video_id
  if (title !== undefined) update.title = title
  if (setlist !== undefined) update.setlist = setlist

  const { data: stream, error } = await supabase
    .from('streams')
    .update(update)
    .eq('id', stream_id)
    .select()
    .single()

  if (error || !stream) return NextResponse.json({ error: 'Failed to update' }, { status: 500 })

  // Broadcast go-live event so all clients refresh
  if (is_live !== undefined) {
    const realtimeClient = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const channel = realtimeClient.channel(`stream:${stream_id}`)
    await channel.send({
      type: 'broadcast',
      event: is_live ? 'stream_live' : 'stream_ended',
      payload: { stream_id, is_live },
    })
  }

  return NextResponse.json({ stream })
}
