import { NextRequest } from 'next/server'
import { verifyAgentKey, agentUnauthorized } from '@/lib/agent-auth'
import { createServiceClient } from '@/lib/supabase-server'

/**
 * GET /api/agent/tips
 * List tips, optionally filtered by stream.
 * Query: ?stream_id=<uuid>
 */
export async function GET(request: NextRequest) {
  if (!verifyAgentKey(request)) return agentUnauthorized()

  const { searchParams } = new URL(request.url)
  const stream_id = searchParams.get('stream_id')

  const supabase = createServiceClient()
  let query = supabase
    .from('tips')
    .select('*, members(name, email, display_name)')
    .order('created_at', { ascending: false })

  if (stream_id) query = query.eq('stream_id', stream_id)

  const { data, error } = await query
  if (error) return Response.json({ error: error.message }, { status: 500 })

  const tips = data ?? []
  const total_cents = tips.reduce((sum, t) => sum + t.amount_cents, 0)

  return Response.json({
    tips,
    count: tips.length,
    total_dollars: (total_cents / 100).toFixed(2),
  })
}
