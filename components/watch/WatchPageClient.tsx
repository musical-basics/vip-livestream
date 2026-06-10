'use client'

import { useState, useEffect, useRef, useCallback, useMemo, type PointerEvent as ReactPointerEvent } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'
import type { Member, Stream, ChatMessage, Comment, SetlistItem } from '@/lib/database.types'
import VideoPlayer from './VideoPlayer'
import ChatPanel from './ChatPanel'
import SetlistPanel from './SetlistPanel'
import CommentSection from './CommentSection'
import TipButton from './TipButton'
import EmojiOverlay from './EmojiOverlay'
import Header from './Header'
import TipBanner from './TipBanner'
import ConcertAnnouncementDialog from './ConcertAnnouncementDialog'
import LeaderboardPanel from './LeaderboardPanel'
import MemberProfileModal from './MemberProfileModal'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { MessageSquare, Music2, MessageCircle, RefreshCw, Trophy } from 'lucide-react'
import { getStreamSources, type StreamSourceId } from '@/lib/stream-sources'

// ── Resize bounds ─────────────────────────────────────────────
const MIN_CHAT_WIDTH   = 280
const MAX_CHAT_WIDTH   = 720
const DEFAULT_CHAT_WIDTH = 400

const MIN_VIDEO_HEIGHT = 220
const MIN_BOTTOM_HEIGHT = 160
const DEFAULT_VIDEO_HEIGHT = 360
const STREAM_SYNC_POLL_MS = 5 * 60 * 1000

// ── Types ─────────────────────────────────────────────────────
interface WatchPageClientProps {
  member: Member
  stream: Stream | null
  initialMessages: ChatMessage[]
  initialComments: Comment[]
  memberDirectory: Member[]
  isMuted: boolean
  /** Global fallback programme (stored or code default) when the stream has no own setlist. */
  programme?: SetlistItem[]
}

interface LeaderboardChatter {
  member_id: string
  display_name: string
  name: string
  name_color: string | null
  access_badges: string[]
  is_moderator: boolean
  message_count: number
}

// ── Drag handle components ────────────────────────────────────
type ResizeMode = 'chat' | 'bottom'

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function VerticalDivider({ onPointerDown }: { onPointerDown: (e: ReactPointerEvent) => void }) {
  return (
    <div
      onPointerDown={onPointerDown}
      className="hidden lg:flex w-3 cursor-col-resize touch-none flex-col items-center justify-center flex-shrink-0 group relative z-10"
      style={{ background: 'transparent' }}
      title="Drag to resize"
    >
      {/* Hover highlight strip */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150"
        style={{ background: 'linear-gradient(to bottom, transparent, oklch(0.75 0.12 85 / 0.12), transparent)' }}
      />
      {/* Grip dots */}
      <div className="relative flex flex-col gap-[4px]">
        {[0,1,2,3,4,5].map(i => (
          <div
            key={i}
            className="w-[3px] h-[3px] rounded-full bg-white/20 group-hover:bg-[oklch(0.75_0.12_85)] transition-colors duration-150"
          />
        ))}
      </div>
    </div>
  )
}

function HorizontalDivider({ onPointerDown }: { onPointerDown: (e: ReactPointerEvent) => void }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          onPointerDown={onPointerDown}
          className="hidden lg:flex h-3 cursor-row-resize touch-none items-center justify-center flex-shrink-0 group relative z-10"
          style={{ background: 'transparent' }}
        >
          {/* Hover highlight strip */}
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150"
            style={{ background: 'linear-gradient(to right, transparent, oklch(0.75 0.12 85 / 0.12), transparent)' }}
          />
          {/* Grip dots */}
          <div className="relative flex gap-[4px]">
            {[0,1,2,3,4,5].map(i => (
              <div
                key={i}
                className="h-[3px] w-[3px] rounded-full bg-white/20 group-hover:bg-[oklch(0.75_0.12_85)] transition-colors duration-150"
              />
            ))}
          </div>
        </div>
      </TooltipTrigger>
      {/* Smaller screens can have the video fill the viewport, hiding the
          programme below — this hints that the bar drags to reveal it. */}
      <TooltipContent side="top">Click to redrag and resize the video</TooltipContent>
    </Tooltip>
  )
}

// ── Main component ────────────────────────────────────────────
export default function WatchPageClient({
  member,
  stream,
  initialMessages,
  initialComments,
  memberDirectory,
  isMuted,
  programme,
}: WatchPageClientProps) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const showConcertAnnouncement = searchParams.get('welcome') === '1'
  const [activeProfileMemberId, setActiveProfileMemberId] = useState<string | null>(null)

  const [floatingEmojis, setFloatingEmojis] = useState<Array<{ id: string; emoji: string; x: number }>>([])
  const [tipBanner, setTipBanner] = useState<{ name: string; amount: number; message?: string } | null>(
    () => searchParams.get('tip_success')
      ? {
          name: member.display_name || member.name,
          amount: 0,
          message: 'Thank you for your support! 💝',
        }
      : null
  )
  const [selectedStreamSource, setSelectedStreamSource] = useState<StreamSourceId>('main')
  const streamSources = useMemo(() => getStreamSources(stream), [stream])
  const selectedSource =
    streamSources.find((source) => source.id === selectedStreamSource && source.videoId) ??
    streamSources.find((source) => source.videoId) ??
    streamSources[0]
  const backup1Available = !!streamSources.find((source) => source.id === 'backup1')?.videoId

  const [autoSwitchingTo, setAutoSwitchingTo] = useState<{ label: string; id: StreamSourceId; countdown: number } | null>(null)

  useEffect(() => {
    if (!autoSwitchingTo) return

    const timer = setTimeout(() => {
      if (autoSwitchingTo.countdown <= 1) {
        setSelectedStreamSource(autoSwitchingTo.id)
        setAutoSwitchingTo(null)
      } else {
        setAutoSwitchingTo((current) => {
          if (!current) return null
          return { ...current, countdown: current.countdown - 1 }
        })
      }
    }, 1000)

    return () => clearTimeout(timer)
  }, [autoSwitchingTo])

  const handlePlaybackError = useCallback((errorVideoId: string) => {
    if (selectedSource?.videoId !== errorVideoId) return

    const backup1Src = streamSources.find((s) => s.id === 'backup1')
    const backup2Src = streamSources.find((s) => s.id === 'backup2')

    let targetSource: typeof backup1Src | undefined = undefined

    if (selectedStreamSource === 'main') {
      if (backup1Src?.videoId) {
        targetSource = backup1Src
      } else if (backup2Src?.videoId) {
        targetSource = backup2Src
      }
    } else if (selectedStreamSource === 'backup1') {
      if (backup2Src?.videoId) {
        targetSource = backup2Src
      }
    }

    if (targetSource) {
      setAutoSwitchingTo({
        label: targetSource.label,
        id: targetSource.id,
        countdown: 3,
      })
    }
  }, [selectedStreamSource, selectedSource, streamSources])

  // Leaderboard state & logic
  const streamId = stream?.id ?? null
  const [leaderboard, setLeaderboard] = useState<LeaderboardChatter[]>([])
  const [isLeaderboardLoading, setIsLeaderboardLoading] = useState(true)
  const [isLeaderboardRefreshing, setIsLeaderboardRefreshing] = useState(false)
  const [leaderboardError, setLeaderboardError] = useState<string | null>(null)

  // Crowd-sourced "stream is down" report. Viewers are the real signal when the
  // encoder/app claims it's still live but the feed is actually black. Once
  // enough distinct viewers report, the API alerts the operators. Repeat taps
  // (incl. after a refresh) are harmless — the server de-dupes per member.
  const [reportingDown, setReportingDown] = useState(false)
  const [streamDownReported, setStreamDownReported] = useState(false)

  const reportStreamDown = useCallback(async () => {
    if (!streamId || reportingDown || streamDownReported) return
    setReportingDown(true)
    try {
      await fetch('/api/stream/report-down', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stream_id: streamId }),
      })
    } catch (err) {
      console.error(err)
    } finally {
      // Mark reported either way — the team still gets the signal from other viewers.
      setStreamDownReported(true)
      setReportingDown(false)
    }
  }, [streamId, reportingDown, streamDownReported])

  const fetchCurrentLeaderboard = useCallback(async (refresh = false) => {
    if (!streamId) {
      setIsLeaderboardLoading(false)
      return
    }

    if (refresh) {
      setIsLeaderboardRefreshing(true)
    } else {
      setIsLeaderboardLoading(true)
    }

    try {
      const res = await fetch(`/api/chat/leaderboard?stream_id=${streamId}&scope=current`)
      if (!res.ok) throw new Error('Failed to fetch leaderboard')
      const data = await res.json() as { leaderboard?: LeaderboardChatter[] }
      setLeaderboard(data.leaderboard || [])
      setLeaderboardError(null)
    } catch (err) {
      console.error(err)
      setLeaderboardError('Could not load chatter leaderboard.')
    } finally {
      setIsLeaderboardLoading(false)
      setIsLeaderboardRefreshing(false)
    }
  }, [streamId])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchCurrentLeaderboard()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [fetchCurrentLeaderboard])

  const handleRealtimeMessage = useCallback((msg: ChatMessage) => {
    if (!msg.member_id) return
    // Exclude automated system milestone events from the chatter leaderboard
    if (msg.content?.startsWith('[System]')) return

    setLeaderboard((prev) => {
      const sender = memberDirectory.find(m => m.id === msg.member_id)
      if (sender && sender.is_admin) {
        return prev
      }

      const existingIndex = prev.findIndex((item) => item.member_id === msg.member_id)
      const next = [...prev]

      if (existingIndex !== -1) {
        const existing = next[existingIndex]
        next[existingIndex] = {
          ...existing,
          message_count: Number(existing.message_count) + 1,
          display_name: msg.display_name || existing.display_name
        }
      } else {
        const displayName = msg.display_name || sender?.display_name || sender?.name || 'Guest'
        next.push({
          member_id: msg.member_id,
          display_name: displayName,
          name: sender?.name || 'Guest',
          name_color: sender?.name_color || null,
          access_badges: sender?.access_badges || [],
          is_moderator: sender?.is_moderator || false,
          message_count: 1
        })
      }

      return next.sort((a, b) => b.message_count - a.message_count).slice(0, 20)
    })
  }, [memberDirectory])

  const topChatterRanks = useMemo(() => {
    const ranks = new Map<string, number>()
    leaderboard.slice(0, 3).forEach((chatter, index) => {
      ranks.set(chatter.member_id, index + 1)
    })
    return ranks
  }, [leaderboard])

  const topChatterMessagesCount = useMemo(() => {
    const counts = new Map<string, number>()
    leaderboard.forEach((chatter) => {
      counts.set(chatter.member_id, Number(chatter.message_count))
    })
    return counts
  }, [leaderboard])

  // Resize state (desktop only)
  const [chatWidth, setChatWidth]       = useState(DEFAULT_CHAT_WIDTH)
  const [videoHeight, setVideoHeight]   = useState(DEFAULT_VIDEO_HEIGHT)
  const [isDesktop, setIsDesktop]       = useState(false)
  const [resizeMode, setResizeMode]     = useState<ResizeMode | null>(null)

  const [activeTab, setActiveTab] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('watch_active_tab') || 'setlist'
    }
    return 'setlist'
  })

  const handleTabChange = useCallback((value: string) => {
    setActiveTab(value)
    localStorage.setItem('watch_active_tab', value)
  }, [])

  // Drag tracking refs
  const mainLayoutRef = useRef<HTMLDivElement>(null)
  const leftColumnRef = useRef<HTMLDivElement>(null)
  const videoWrapRef  = useRef<HTMLDivElement>(null)
  const hasResizedVideoRef = useRef(false)
  const [reloadCountdown, setReloadCountdown] = useState<number | null>(null)
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const isReloadingRef = useRef(false)
  const dragStateRef  = useRef<{
    mode: ResizeMode
    startX: number
    startY: number
    startChatWidth: number
    startVideoHeight: number
  } | null>(null)

  const getMaxChatWidth = useCallback(() => {
    const layoutWidth = mainLayoutRef.current?.getBoundingClientRect().width ?? window.innerWidth
    return Math.max(MIN_CHAT_WIDTH, Math.min(MAX_CHAT_WIDTH, layoutWidth - 360))
  }, [])

  const getMaxVideoHeight = useCallback(() => {
    const columnHeight = leftColumnRef.current?.getBoundingClientRect().height
      ?? mainLayoutRef.current?.getBoundingClientRect().height
      ?? window.innerHeight
    return Math.max(MIN_VIDEO_HEIGHT, columnHeight - MIN_BOTTOM_HEIGHT - 12)
  }, [])

  const getNaturalVideoHeight = useCallback(() => {
    const columnWidth = leftColumnRef.current?.getBoundingClientRect().width || window.innerWidth
    const cappedWidth = Math.min(columnWidth, 1920)
    return Math.round(cappedWidth * 9 / 16)
  }, [])

  // Detect desktop breakpoint
  useEffect(() => {
    const check = () => {
      const desktop = window.innerWidth >= 1024
      setIsDesktop(desktop)
      if (desktop) {
        setChatWidth((width) => clamp(width, MIN_CHAT_WIDTH, getMaxChatWidth()))
        setVideoHeight((height) =>
          clamp(
            hasResizedVideoRef.current ? height : getNaturalVideoHeight(),
            MIN_VIDEO_HEIGHT,
            getMaxVideoHeight()
          )
        )
      }
    }
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [getMaxChatWidth, getMaxVideoHeight, getNaturalVideoHeight])

  // Global pointer listeners keep resizing stable even over iframes and scrollable panes.
  useEffect(() => {
    const onPointerMove = (e: PointerEvent) => {
      const dragState = dragStateRef.current
      if (!dragState) return
      e.preventDefault()

      if (dragState.mode === 'chat') {
        const delta = dragState.startX - e.clientX
        setChatWidth(clamp(dragState.startChatWidth + delta, MIN_CHAT_WIDTH, getMaxChatWidth()))
      } else {
        const delta = e.clientY - dragState.startY
        setVideoHeight(clamp(dragState.startVideoHeight + delta, MIN_VIDEO_HEIGHT, getMaxVideoHeight()))
      }
    }

    const stopResize = () => {
      dragStateRef.current = null
      setResizeMode(null)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    window.addEventListener('pointermove', onPointerMove, { passive: false })
    window.addEventListener('pointerup', stopResize)
    window.addEventListener('pointercancel', stopResize)
    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', stopResize)
      window.removeEventListener('pointercancel', stopResize)
    }
  }, [getMaxChatWidth, getMaxVideoHeight])

  const startResize = useCallback((mode: ResizeMode, e: ReactPointerEvent) => {
    if (!isDesktop) return
    e.preventDefault()
    dragStateRef.current = {
      mode,
      startX: e.clientX,
      startY: e.clientY,
      startChatWidth: chatWidth,
      startVideoHeight: videoHeight,
    }
    if (mode === 'bottom') hasResizedVideoRef.current = true
    setResizeMode(mode)
    document.body.style.cursor = mode === 'chat' ? 'col-resize' : 'row-resize'
    document.body.style.userSelect = 'none'
  }, [chatWidth, isDesktop, videoHeight])

  const refreshWatchPage = useCallback(() => {
    if (isReloadingRef.current) return
    isReloadingRef.current = true

    const duration = Math.floor(Math.random() * 5) + 3 // 3, 4, 5, 6, or 7 seconds
    setReloadCountdown(duration)

    let currentCount = duration
    countdownIntervalRef.current = setInterval(() => {
      currentCount -= 1
      if (currentCount <= 0) {
        if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current)
          countdownIntervalRef.current = null
        }
        window.location.reload()
      } else {
        setReloadCountdown(currentCount)
      }
    }, 1000)
  }, [])

  useEffect(() => {
    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current)
      }
    }
  }, [])

  // Auto-refresh and realtime updates when the active stream changes.
  useEffect(() => {
    const supabase = createClient()
    const statusChannel = supabase
      .channel('stream-status')
      .on('broadcast', { event: 'stream_live' }, refreshWatchPage)
      .on('broadcast', { event: 'stream_ended' }, refreshWatchPage)
      .on('broadcast', { event: 'stream_updated' }, refreshWatchPage)
      .subscribe()
    const currentStreamChannel = stream?.id
      ? supabase
          .channel(`stream:${stream.id}`)
          .on('broadcast', { event: 'stream_live' }, refreshWatchPage)
          .on('broadcast', { event: 'stream_ended' }, refreshWatchPage)
          .on('broadcast', { event: 'stream_updated' }, refreshWatchPage)
          .on('broadcast', { event: 'new_message' }, ({ payload }) => {
            handleRealtimeMessage(payload as ChatMessage)
          })
          .subscribe()
      : null

    return () => {
      supabase.removeChannel(statusChannel)
      if (currentStreamChannel) supabase.removeChannel(currentStreamChannel)
    }
  }, [stream?.id, refreshWatchPage, handleRealtimeMessage])

  // Realtime can be missed if a tab sleeps. Poll lightly as a safety net.
  useEffect(() => {
    let isDisposed = false
    const checkForStreamChange = async (force = false) => {
      if (!force && document.visibilityState !== 'visible') return

      try {
        const res = await fetch('/api/stream/sync', { cache: 'no-store' })
        if (!res.ok || isDisposed) return

        const data = await res.json() as {
          is_live?: boolean
          stream_id?: string
          youtube_video_id?: string
          backup_youtube_video_id_1?: string | null
          backup_youtube_video_id_2?: string | null
        }

        const activeStreamChanged =
          data.is_live === true &&
          (
            data.stream_id !== stream?.id ||
            data.youtube_video_id !== stream?.youtube_video_id ||
            (data.backup_youtube_video_id_1 ?? null) !== (stream?.backup_youtube_video_id_1 ?? null) ||
            (data.backup_youtube_video_id_2 ?? null) !== (stream?.backup_youtube_video_id_2 ?? null)
          )
        const activeStreamEnded = !!stream?.is_live && data.is_live === false
        const streamCameOnline = !stream?.is_live && data.is_live === true

        if (activeStreamChanged || activeStreamEnded || streamCameOnline) {
          refreshWatchPage()
        }
      } catch {
        // The next interval will try again.
      }
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void checkForStreamChange(true)
      }
    }

    const interval = window.setInterval(checkForStreamChange, STREAM_SYNC_POLL_MS)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      isDisposed = true
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [
    stream?.id,
    stream?.is_live,
    stream?.youtube_video_id,
    stream?.backup_youtube_video_id_1,
    stream?.backup_youtube_video_id_2,
    refreshWatchPage,
  ])

  // Show tip success notification
  useEffect(() => {
    if (!searchParams.get('tip_success')) return

    router.replace('/watch')
    const timeout = window.setTimeout(() => setTipBanner(null), 5000)
    return () => window.clearTimeout(timeout)
  }, [searchParams, router])

  const closeConcertAnnouncement = useCallback(() => {
    router.replace('/watch')
  }, [router])

  function addFloatingEmoji(emoji: string) {
    const id = `${Date.now()}-${Math.random()}`
    const x  = 10 + Math.random() * 80
    setFloatingEmojis(prev => {
      if (prev.length >= 60) return prev
      return [...prev, { id, emoji, x }]
    })
    setTimeout(() => {
      setFloatingEmojis(prev => prev.filter(e => e.id !== id))
    }, 2600)
  }

  const [mobileTab, setMobileTab] = useState<'chat' | 'programme'>('chat')

  // Shared content blocks, rendered in either the desktop split layout or the
  // mobile tabbed layout. Defined once so nothing double-mounts.
  const programmeContent = (
    <>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2
            className="text-xl font-light leading-tight text-gold sm:text-2xl"
            style={{ fontFamily: "'Cormorant Garamond', serif" }}
          >
            {stream?.title || 'VIP Piano Livestream'}
          </h2>
          {stream?.description && (
            <p className="text-sm text-muted-foreground mt-1">{stream.description}</p>
          )}
        </div>
        <div className="w-full sm:w-auto">
          <TipButton member={member} stream={stream} />
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="glass mb-4 grid w-full grid-cols-3 sm:inline-flex sm:w-auto">
          <TabsTrigger value="setlist" className="flex items-center justify-center gap-2">
            <Music2 className="w-3.5 h-3.5" />
            <span>Programme</span>
          </TabsTrigger>
          <TabsTrigger value="comments" className="flex items-center justify-center gap-2">
            <MessageCircle className="w-3.5 h-3.5" />
            <span>Leave a Note</span>
          </TabsTrigger>
          <TabsTrigger value="leaderboard" className="flex items-center justify-center gap-2">
            <Trophy className="w-3.5 h-3.5" />
            <span>Leaderboard</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="setlist">
          <SetlistPanel stream={stream} programme={programme} />
        </TabsContent>

        <TabsContent value="comments">
          <CommentSection
            member={member}
            stream={stream}
            initialComments={initialComments}
          />
        </TabsContent>

        <TabsContent value="leaderboard">
          <LeaderboardPanel
            memberDirectory={memberDirectory}
            leaderboard={leaderboard}
            isLoading={isLeaderboardLoading}
            isRefreshing={isLeaderboardRefreshing}
            error={leaderboardError}
            onRefresh={() => fetchCurrentLeaderboard(true)}
            onSelectMemberId={setActiveProfileMemberId}
          />
        </TabsContent>
      </Tabs>
    </>
  )

  const chatPanel = (
    <ChatPanel
      key={stream?.id ?? 'waiting-room'}
      member={member}
      stream={stream}
      initialMessages={initialMessages}
      memberDirectory={memberDirectory}
      isMuted={isMuted}
      onEmojiReaction={addFloatingEmoji}
      onTipBanner={setTipBanner}
      highlightNameEditor={showConcertAnnouncement}
      topChatterRanks={topChatterRanks}
      chatterMessagesCountMap={topChatterMessagesCount}
      onSelectMemberId={setActiveProfileMemberId}
    />
  )

    return (
      <div className="flex h-[100dvh] flex-col overflow-hidden">
        <Header member={member} stream={stream} />
      {stream && (
        <div className="border-b border-border/30 bg-black/75 px-3 py-2 backdrop-blur sm:px-4">
          <div
            role="tablist"
            aria-label="Livestream source"
            className="mx-auto grid w-full max-w-2xl grid-cols-3 gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1"
          >
            {streamSources.map((source) => {
              const isSelected = selectedSource?.id === source.id
              const isAvailable = !!source.videoId

              return (
                <button
                  key={source.id}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  disabled={!isAvailable}
                  onClick={() => {
                    setAutoSwitchingTo(null)
                    setSelectedStreamSource(source.id)
                  }}
                  className={`min-h-10 rounded-lg px-2 text-center text-[11px] font-semibold uppercase tracking-wide transition-colors sm:text-xs ${
                    isSelected
                      ? 'bg-[oklch(0.75_0.12_85)] text-[oklch(0.09_0.015_270)] shadow-lg shadow-black/20'
                      : 'text-muted-foreground hover:bg-white/8 hover:text-foreground'
                  } disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent disabled:hover:text-muted-foreground`}
                >
                  {source.label}
                </button>
              )
            })}
          </div>
          <div className="mx-auto mt-1.5 w-full max-w-2xl">
            <p className="text-center text-[11px] leading-snug text-muted-foreground">
              Video frozen or dropped?{' '}
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="font-medium text-foreground underline decoration-dotted underline-offset-2 transition-colors hover:text-[oklch(0.75_0.12_85)]"
              >
                Refresh the page
              </button>
              {backup1Available ? (
                <>
                  , or switch to <span className="font-medium text-foreground">Backup Stream 1</span> above.
                </>
              ) : (
                '.'
              )}
            </p>
            <div className="mt-1 flex justify-center">
              <button
                type="button"
                onClick={reportStreamDown}
                disabled={reportingDown || streamDownReported}
                className="text-[11px] text-muted-foreground/70 transition-colors hover:text-foreground disabled:cursor-default disabled:hover:text-muted-foreground/70"
              >
                {streamDownReported
                  ? '✓ Thanks — we’ve flagged the stream for the team'
                  : reportingDown
                    ? 'Reporting…'
                    : '⚠ Stream not playing? Tap to report it'}
              </button>
            </div>
          </div>
        </div>
      )}
        {resizeMode && (
          <div
          className="fixed inset-0 z-[9999]"
          style={{ cursor: resizeMode === 'chat' ? 'col-resize' : 'row-resize' }}
        />
      )}

      {reloadCountdown !== null && (
        <div className="fixed inset-0 z-[10000] flex flex-col items-center justify-center bg-black/80 backdrop-blur-md transition-opacity duration-300">
          <div className="glass max-w-md w-full mx-4 p-8 rounded-2xl border border-white/10 flex flex-col items-center text-center shadow-2xl relative overflow-hidden">
            {/* Ambient glow in background */}
            <div className="absolute -inset-10 bg-[radial-gradient(circle_at_center,oklch(0.75_0.12_85_/_0.15)_0%,transparent_70%)] pointer-events-none" />
            
            <div className="relative z-10 flex flex-col items-center">
              <div className="relative mb-6">
                <div className="absolute inset-0 rounded-full bg-[oklch(0.75_0.12_85)]/10 animate-ping duration-1000" />
                <div className="relative flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-black/60 text-[oklch(0.75_0.12_85)] shadow-inner">
                  <RefreshCw className="h-8 w-8 animate-spin" style={{ animationDuration: '3s' }} />
                </div>
              </div>

              <h2 className="text-2xl font-light text-gold mb-3" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
                Updating Livestream URL
              </h2>
              
              <p className="text-sm text-muted-foreground mb-8 max-w-xs leading-relaxed">
                The stream settings are being synchronized. We will reconnect you automatically in a moment.
              </p>

              <div className="relative flex items-center justify-center">
                <div className="text-5xl font-extralight text-gold tracking-tight select-none">
                  {reloadCountdown}
                </div>
                <span className="text-xs text-muted-foreground/60 uppercase tracking-widest ml-2 mt-4">
                  seconds
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tip banner */}
      {tipBanner && (
        <TipBanner
          name={tipBanner.name}
          amount={tipBanner.amount}
          message={tipBanner.message}
          onClose={() => setTipBanner(null)}
        />
      )}
      <ConcertAnnouncementDialog
        open={showConcertAnnouncement}
        onClose={closeConcertAnnouncement}
      />

      {/* Auto-switching countdown notification */}
      {autoSwitchingTo && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-red-950/90 border border-red-500/30 text-red-200 px-4 py-3 rounded-xl shadow-2xl backdrop-blur-md animate-[bounce_1s_infinite] max-w-xs sm:max-w-md w-auto">
          <RefreshCw className="w-4 h-4 animate-spin text-red-400 shrink-0 animate-[spin_2s_linear_infinite]" />
          <div className="text-xs text-left">
            <span className="font-semibold block text-red-300">Feed Disruption Detected</span>
            <span>Switching to {autoSwitchingTo.label} in {autoSwitchingTo.countdown}s...</span>
          </div>
        </div>
      )}

      {isDesktop ? (
        /* Desktop: video + tabs on the left, chat on the right */
        <div ref={mainLayoutRef} className="flex flex-1 min-h-0 flex-row overflow-hidden">
          <div ref={leftColumnRef} className="flex min-w-0 min-h-0 flex-1 flex-col overflow-hidden">
            <div
              ref={videoWrapRef}
              className="relative w-full max-w-[1920px] mx-auto flex-shrink-0 bg-black"
              style={{ height: videoHeight }}
            >
              <VideoPlayer
                stream={stream}
                fill
                videoId={selectedSource?.videoId}
                onPlaybackError={handlePlaybackError}
              />
              <EmojiOverlay emojis={floatingEmojis} />
            </div>

            <HorizontalDivider onPointerDown={(e) => startResize('bottom', e)} />

            <div className="flex-1 min-h-0 overflow-y-auto p-6">
              {programmeContent}
            </div>
          </div>

          <VerticalDivider onPointerDown={(e) => startResize('chat', e)} />

          <div
            className="flex min-h-0 flex-col border-l border-border/50"
            style={{ width: chatWidth, flexShrink: 0 }}
          >
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border/50 glass-heavy">
              <MessageSquare className="w-4 h-4 text-[oklch(0.75_0.12_85)]" />
              <span className="text-sm font-medium">Live Chat</span>
              {stream?.is_live && (
                <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 font-medium flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400 live-pulse inline-block" />
                  LIVE
                </span>
              )}
            </div>
            {chatPanel}
          </div>
        </div>
      ) : (
        /* Mobile: pinned video, then a Chat / Programme tab switcher */
        <div className="flex flex-1 min-h-0 flex-col">
          <div className="relative w-full flex-shrink-0 bg-black">
            <VideoPlayer
              stream={stream}
              videoId={selectedSource?.videoId}
              onPlaybackError={handlePlaybackError}
            />
            <EmojiOverlay emojis={floatingEmojis} />
          </div>

          <div className="grid grid-cols-2 shrink-0 glass-heavy border-b border-border/50">
            <button
              onClick={() => setMobileTab('chat')}
              className={`flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${
                mobileTab === 'chat'
                  ? 'text-foreground border-b-2 border-[oklch(0.75_0.12_85)]'
                  : 'text-muted-foreground'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              Live Chat
              {stream?.is_live && (
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 live-pulse inline-block" />
              )}
            </button>
            <button
              onClick={() => setMobileTab('programme')}
              className={`flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${
                mobileTab === 'programme'
                  ? 'text-foreground border-b-2 border-[oklch(0.75_0.12_85)]'
                  : 'text-muted-foreground'
              }`}
            >
              <Music2 className="w-4 h-4" />
              Programme
            </button>
          </div>

          <div className="flex-1 min-h-0">
            <div className={mobileTab === 'chat' ? 'flex h-full flex-col' : 'hidden'}>
              {chatPanel}
            </div>
            <div className={mobileTab === 'programme' ? 'block h-full overflow-y-auto p-3 pb-6' : 'hidden'}>
              {programmeContent}
            </div>
          </div>
        </div>
      )}
      <MemberProfileModal
        open={!!activeProfileMemberId}
        memberId={activeProfileMemberId}
        streamId={stream?.id || null}
        onClose={() => setActiveProfileMemberId(null)}
      />
    </div>
  )
}
