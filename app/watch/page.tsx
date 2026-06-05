import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { getVerifiedLiveStream } from '@/lib/live-stream'
import { createServiceClient } from '@/lib/supabase-server'
import WatchPageClient from '@/components/watch/WatchPageClient'
import type { ChatMessage, Comment, Member, Stream } from '@/lib/database.types'

export default async function WatchPage() {
  const member = await getSession()
  if (!member) redirect('/')

  const supabase = createServiceClient()

  // Only a YouTube-confirmed active live stream belongs on /watch.
  const stream: Stream | null = await getVerifiedLiveStream(supabase)

  let roomStream = stream
  if (!roomStream) {
    const { data: newestStream } = await supabase
      .from('streams')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    roomStream = newestStream ?? null
  }

  // Fetch room-dependent data in parallel once we have a stream record. When
  // the video is waiting, the newest stream record acts as the chat room.
  const [messagesRes, commentsRes, timeoutRes, membersRes] = roomStream
    ? await Promise.all([
        supabase
          .from('chat_messages')
          .select('*')
          .eq('stream_id', roomStream.id)
          .eq('is_muted', false)
          .order('created_at', { ascending: false })
          .limit(50),
        supabase
          .from('comments')
          .select('*')
          .eq('stream_id', roomStream.id)
          .eq('is_approved', true)
          .order('created_at', { ascending: true }),
        supabase
          .from('member_timeouts')
          .select('id')
          .eq('member_id', member.id)
          .eq('stream_id', roomStream.id)
          .or(`timeout_until.is.null,timeout_until.gt.${new Date().toISOString()}`)
          .limit(1)
          .maybeSingle(),
        supabase
          .from('members')
          .select('*')
          .eq('is_banned', false),
      ])
    : [{ data: [] }, { data: [] }, { data: null }, { data: [] }]

  const initialMessages = [...((messagesRes.data ?? []) as ChatMessage[])].reverse()
  const initialComments = (commentsRes.data ?? []) as Comment[]

  return (
    <WatchPageClient
      member={member}
      stream={roomStream}
      initialMessages={initialMessages}
      initialComments={initialComments}
      memberDirectory={(membersRes.data as Member[]) || []}
      isMuted={!!timeoutRes.data}
    />
  )
}
