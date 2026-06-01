import { NextRequest } from 'next/server'
import { verifyAgentKey, agentUnauthorized } from '@/lib/agent-auth'
import { createServiceClient } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'

function realtimeClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
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
 */
export async function POST(request: NextRequest) {
  if (!verifyAgentKey(request)) return agentUnauthorized()

  const body = await request.json()
  const { title, youtube_video_id, description, setlist, is_live } = body

  if (!title || !youtube_video_id) {
    return Response.json({ error: 'title and youtube_video_id are required' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { data: stream, error } = await supabase
    .from('streams')
    .insert({ title, youtube_video_id, description, setlist, is_live: is_live ?? false })
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true, stream }, { status: 201 })
}

/**
 * PATCH /api/agent/stream
 * Update a stream. Can go live, end stream, change video, etc.
 * Body: { stream_id, is_live?, youtube_video_id?, title?, description?, setlist?, stream_start_utc? }
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

  if (error) return Response.json({ error: error.message }, { status: 500 })

  // Broadcast go-live / stream-ended events to all connected clients
  if ('is_live' in update) {
    const rt = realtimeClient()
    const ch = rt.channel(`stream:${stream_id}`)
    await ch.send({
      type: 'broadcast',
      event: update.is_live ? 'stream_live' : 'stream_ended',
      payload: { stream_id, is_live: update.is_live },
    })
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
