import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { canModerateChat } from '@/lib/roles'
import { createServiceClient } from '@/lib/supabase-server'
import { createClient as createBrowserClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  const member = await getSession()
  if (!member) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!canModerateChat(member)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { stream_id, slow_mode_delay } = await request.json()

  if (!stream_id) {
    return NextResponse.json({ error: 'stream_id required' }, { status: 400 })
  }

  if (
    typeof slow_mode_delay !== 'number' ||
    slow_mode_delay < 0 ||
    slow_mode_delay > 300 ||
    !Number.isInteger(slow_mode_delay)
  ) {
    return NextResponse.json(
      { error: 'slow_mode_delay must be an integer between 0 and 300' },
      { status: 400 }
    )
  }

  const supabase = createServiceClient()

  // Update the stream with the new slow mode delay
  const { error: updateError } = await supabase
    .from('streams')
    .update({ slow_mode_delay })
    .eq('id', stream_id)

  if (updateError) {
    return NextResponse.json({ error: 'Failed to update stream' }, { status: 500 })
  }

  // Broadcast the update in real-time
  const realtimeClient = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const channel = realtimeClient.channel(`stream:${stream_id}`)
  await channel.send({
    type: 'broadcast',
    event: 'slow_mode_updated',
    payload: {
      slow_mode_delay,
    },
  })

  return NextResponse.json({ slow_mode_delay })
}
