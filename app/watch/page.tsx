import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase-server'
import WatchPageClient from '@/components/watch/WatchPageClient'
import type { Stream, SetlistItem } from '@/lib/database.types'

export default async function WatchPage() {
  const member = await getSession()
  if (!member) redirect('/')

  const supabase = createServiceClient()

  // Get the most recent stream (live or not)
  const { data: stream } = await supabase
    .from('streams')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  // Get initial chat messages (last 50)
  const { data: initialMessages } = stream
    ? await supabase
        .from('chat_messages')
        .select('*')
        .eq('stream_id', stream.id)
        .eq('is_muted', false)
        .order('created_at', { ascending: false })
        .limit(50)
    : { data: [] }

  // Get comments
  const { data: initialComments } = stream
    ? await supabase
        .from('comments')
        .select('*')
        .eq('stream_id', stream.id)
        .eq('is_approved', true)
        .order('created_at', { ascending: true })
    : { data: [] }

  // Get active timeouts for this member
  const { data: myTimeout } = stream
    ? await supabase
        .from('member_timeouts')
        .select('*')
        .eq('member_id', member.id)
        .eq('stream_id', stream.id)
        .or(`timeout_until.is.null,timeout_until.gt.${new Date().toISOString()}`)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
    : { data: null }

  return (
    <WatchPageClient
      member={member}
      stream={stream as Stream | null}
      initialMessages={(initialMessages || []).reverse()}
      initialComments={initialComments || []}
      isMuted={!!myTimeout}
    />
  )
}
