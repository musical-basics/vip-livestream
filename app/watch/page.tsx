import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase-server'
import WatchPageClient from '@/components/watch/WatchPageClient'
import type { Member, Stream } from '@/lib/database.types'

export default async function WatchPage() {
  const member = await getSession()
  if (!member) redirect('/')

  const supabase = createServiceClient()

  // Get the most recent stream. maybeSingle() returns null (no error) when no rows exist.
  const { data: existingStream } = await supabase
    .from('streams')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // Auto-provision a default stream if none exists yet.
  // This ensures chat, comments, and the watch page work immediately on first visit.
  const stream: Stream | null = existingStream ?? (
    await supabase
      .from('streams')
      .insert({
        title: 'VIP Piano Livestream',
        youtube_video_id: '',
        is_live: false,
        description: '',
      })
      .select()
      .single()
  ).data

  // Fetch all stream-dependent data in parallel once we have a stream
  const [messagesRes, commentsRes, timeoutRes, membersRes] = stream
    ? await Promise.all([
        supabase
          .from('chat_messages')
          .select('*')
          .eq('stream_id', stream.id)
          .eq('is_muted', false)
          .order('created_at', { ascending: false })
          .limit(50),
        supabase
          .from('comments')
          .select('*')
          .eq('stream_id', stream.id)
          .eq('is_approved', true)
          .order('created_at', { ascending: true }),
        supabase
          .from('member_timeouts')
          .select('id')
          .eq('member_id', member.id)
          .eq('stream_id', stream.id)
          .or(`timeout_until.is.null,timeout_until.gt.${new Date().toISOString()}`)
          .limit(1)
          .maybeSingle(),
        supabase
          .from('members')
          .select('*')
          .eq('is_banned', false),
      ])
    : [{ data: [] }, { data: [] }, { data: null }, { data: [] }]

  return (
    <WatchPageClient
      member={member}
      stream={stream}
      initialMessages={((messagesRes.data as any[]) || []).reverse()}
      initialComments={(commentsRes.data as any[]) || []}
      memberDirectory={(membersRes.data as Member[]) || []}
      isMuted={!!timeoutRes.data}
    />
  )
}
