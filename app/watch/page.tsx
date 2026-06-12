import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { getVerifiedLiveStream } from '@/lib/live-stream'
import { createServiceClient } from '@/lib/supabase-server'
import { fetchYouTubeVideoMetadata } from '@/lib/youtube-metadata'
import WatchPageClient, { type ReplayData } from '@/components/watch/WatchPageClient'
import type { ChatMessage, Comment, Member, Stream } from '@/lib/database.types'

// Supabase caps a single select at 1000 rows; page through to get the full
// chat history of the show (a couple thousand messages at most).
const CHAT_HISTORY_PAGE_SIZE = 1000
const CHAT_HISTORY_MAX_PAGES = 10

async function fetchFullChatHistory(
  supabase: ReturnType<typeof createServiceClient>,
  streamId: string
): Promise<ChatMessage[]> {
  const history: ChatMessage[] = []

  for (let page = 0; page < CHAT_HISTORY_MAX_PAGES; page += 1) {
    const from = page * CHAT_HISTORY_PAGE_SIZE
    const { data } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('stream_id', streamId)
      .eq('is_muted', false)
      .order('created_at', { ascending: true })
      .range(from, from + CHAT_HISTORY_PAGE_SIZE - 1)

    const batch = (data ?? []) as ChatMessage[]
    history.push(...batch)
    if (batch.length < CHAT_HISTORY_PAGE_SIZE) break
  }

  return history
}

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

  // When the room stream's broadcast has finished on YouTube, the page becomes
  // a replay: the recording plays with the original chat re-appearing in sync.
  // YouTube's actual on-air timestamp anchors video time 0:00, so each
  // message's created_at maps to an exact video position.
  let replay: ReplayData | null = null
  const mainVideoId = roomStream?.youtube_video_id?.trim()
  if (roomStream && mainVideoId) {
    const metadata = await fetchYouTubeVideoMetadata(mainVideoId, { revalidate: 300 })
    // Fallback when YouTube is unreachable from the server: a stream that went
    // live in the past (stream_start_utc is stamped at go-live) and has since
    // been marked ended in the DB is a finished show, so replay it.
    const streamStartMs = roomStream.stream_start_utc
      ? Date.parse(roomStream.stream_start_utc)
      : Number.NaN
    const endedPerDb =
      !roomStream.is_live &&
      Number.isFinite(streamStartMs) &&
      streamStartMs < new Date().getTime() &&
      metadata.broadcastStatus !== 'live'

    if (metadata.broadcastStatus === 'ended' || endedPerDb) {
      replay = {
        startUtc:
          metadata.actualStartTime ?? roomStream.stream_start_utc ?? roomStream.created_at,
        messages: await fetchFullChatHistory(supabase, roomStream.id),
      }
    }
  }

  // Fetch room-dependent data in parallel once we have a stream record. When
  // the video is waiting, the newest stream record acts as the chat room.
  const [messagesRes, commentsRes, timeoutRes, membersRes] = roomStream
    ? await Promise.all([
        replay
          ? Promise.resolve({ data: [] as ChatMessage[] })
          : supabase
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
      replay={replay}
    />
  )
}
