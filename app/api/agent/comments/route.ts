import { NextRequest } from 'next/server'
import { verifyAgentKey, agentUnauthorized } from '@/lib/agent-auth'
import { createServiceClient } from '@/lib/supabase-server'

/**
 * GET /api/agent/comments
 * List comments for a stream.
 * Query: ?stream_id=<uuid>&include_hidden=true
 */
export async function GET(request: NextRequest) {
  if (!verifyAgentKey(request)) return agentUnauthorized()

  const { searchParams } = new URL(request.url)
  const stream_id      = searchParams.get('stream_id')
  const includeHidden  = searchParams.get('include_hidden') === 'true'

  if (!stream_id) return Response.json({ error: 'stream_id query param is required' }, { status: 400 })

  const supabase = createServiceClient()
  let query = supabase
    .from('comments')
    .select('*')
    .eq('stream_id', stream_id)
    .order('created_at', { ascending: true })

  if (!includeHidden) query = query.eq('is_approved', true)

  const { data, error } = await query
  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ comments: data ?? [], count: data?.length ?? 0 })
}

/**
 * PATCH /api/agent/comments
 * Approve or hide a comment.
 * Body: { comment_id, is_approved: true|false }
 */
export async function PATCH(request: NextRequest) {
  if (!verifyAgentKey(request)) return agentUnauthorized()

  const { comment_id, is_approved } = await request.json()
  if (!comment_id || typeof is_approved !== 'boolean') {
    return Response.json({ error: 'comment_id and is_approved (boolean) are required' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('comments')
    .update({ is_approved })
    .eq('id', comment_id)
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true, comment: data })
}

/**
 * DELETE /api/agent/comments
 * Hard-delete a comment.
 * Body: { comment_id }
 */
export async function DELETE(request: NextRequest) {
  if (!verifyAgentKey(request)) return agentUnauthorized()

  const { comment_id } = await request.json()
  if (!comment_id) return Response.json({ error: 'comment_id is required' }, { status: 400 })

  const supabase = createServiceClient()
  const { error } = await supabase.from('comments').delete().eq('id', comment_id)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true, deleted: comment_id })
}
