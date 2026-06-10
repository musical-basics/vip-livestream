import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase-server'
import { dispatchStreamDownAlert } from '@/lib/stream-alerts'

export const dynamic = 'force-dynamic'

const WINDOW_MS = 5 * 60 * 1000 // count reports from the last 5 minutes
const ALERT_COOLDOWN_MS = 10 * 60 * 1000 // don't re-alert within 10 minutes
const THRESHOLD = Math.max(1, Number(process.env.STREAM_DOWN_THRESHOLD || 3))

export async function POST(request: NextRequest) {
  const member = await getSession()
  if (!member) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { stream_id?: string }
  try {
    body = await request.json()
  } catch {
    body = {}
  }
  const streamId = body.stream_id
  if (!streamId) return NextResponse.json({ error: 'stream_id required' }, { status: 400 })

  const supabase = createServiceClient()
  const sinceIso = new Date(Date.now() - WINDOW_MS).toISOString()

  try {
    // De-dupe: skip insert if this member already reported within the window, so
    // one person mashing the button can't trip the threshold by themselves.
    const { data: mine } = await supabase
      .from('stream_down_reports')
      .select('id')
      .eq('stream_id', streamId)
      .eq('member_id', member.id)
      .gte('created_at', sinceIso)
      .limit(1)

    if (!mine || mine.length === 0) {
      const { error: insertErr } = await supabase
        .from('stream_down_reports')
        .insert({ stream_id: streamId, member_id: member.id })
      if (insertErr) throw insertErr
    }

    // Count DISTINCT reporters in the window.
    const { data: recent, error: recentErr } = await supabase
      .from('stream_down_reports')
      .select('member_id')
      .eq('stream_id', streamId)
      .gte('created_at', sinceIso)
    if (recentErr) throw recentErr

    const distinct = new Set((recent ?? []).map((r) => (r as { member_id: string }).member_id))
    const count = distinct.size

    let alerted = false
    if (count >= THRESHOLD) {
      // Cooldown: only fire if we haven't alerted for this stream recently.
      const cooldownIso = new Date(Date.now() - ALERT_COOLDOWN_MS).toISOString()
      const { data: recentAlert } = await supabase
        .from('stream_down_alerts')
        .select('id')
        .eq('stream_id', streamId)
        .gte('alerted_at', cooldownIso)
        .limit(1)

      if (!recentAlert || recentAlert.length === 0) {
        // Record the alert BEFORE dispatching so near-simultaneous reports don't
        // each fire their own alert.
        await supabase
          .from('stream_down_alerts')
          .insert({ stream_id: streamId, report_count: count })

        const { data: stream } = await supabase
          .from('streams')
          .select('title')
          .eq('id', streamId)
          .maybeSingle()

        await dispatchStreamDownAlert({
          streamTitle: (stream as { title?: string } | null)?.title || 'Livestream',
          reportCount: count,
        })
        alerted = true
      }
    }

    return NextResponse.json({ ok: true, reports: count, threshold: THRESHOLD, alerted })
  } catch (err) {
    // Degrade gracefully if the tables aren't migrated yet — never error the
    // viewer (their tap still "worked" from their perspective).
    console.error('report-down failed (are the stream_down_* tables migrated?):', err)
    return NextResponse.json({ ok: true, reports: 0, recorded: false })
  }
}
