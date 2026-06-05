import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { canModerateChat } from '@/lib/roles'
import { createServiceClient } from '@/lib/supabase-server'
import { createClient as createBrowserClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  const member = await getSession()
  if (!canModerateChat(member)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { target_member_id, stream_id, minutes } = await request.json()

  const supabase = createServiceClient()

  const timeoutUntil = minutes
    ? new Date(Date.now() + minutes * 60 * 1000).toISOString()
    : null // null = permanent

  await supabase.from('member_timeouts').insert({
    member_id: target_member_id,
    stream_id,
    muted_by: member.id,
    timeout_until: timeoutUntil,
  })

  // Broadcast to let the client update their mute state
  const realtimeClient = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const channel = realtimeClient.channel(`stream:${stream_id}`)
  await channel.send({
    type: 'broadcast',
    event: 'member_muted',
    payload: { member_id: target_member_id },
  })

  return NextResponse.json({ success: true })
}
