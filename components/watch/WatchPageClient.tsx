'use client'

import { useState, useEffect, useRef, useCallback, type PointerEvent as ReactPointerEvent } from 'react'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { MessageSquare, Music2, MessageCircle } from 'lucide-react'

// ── Resize bounds ─────────────────────────────────────────────
const MIN_CHAT_WIDTH   = 280
const MAX_CHAT_WIDTH   = 720
const DEFAULT_CHAT_WIDTH = 400

const MIN_VIDEO_HEIGHT = 220
const MIN_BOTTOM_HEIGHT = 160
const DEFAULT_VIDEO_HEIGHT = 360

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
    <div
      onPointerDown={onPointerDown}
      className="hidden lg:flex h-3 cursor-row-resize touch-none items-center justify-center flex-shrink-0 group relative z-10"
      style={{ background: 'transparent' }}
      title="Drag to resize"
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

  // Resize state (desktop only)
  const [chatWidth, setChatWidth]       = useState(DEFAULT_CHAT_WIDTH)
  const [videoHeight, setVideoHeight]   = useState(DEFAULT_VIDEO_HEIGHT)
  const [isDesktop, setIsDesktop]       = useState(false)
  const [resizeMode, setResizeMode]     = useState<ResizeMode | null>(null)

  // Drag tracking refs
  const mainLayoutRef = useRef<HTMLDivElement>(null)
  const leftColumnRef = useRef<HTMLDivElement>(null)
  const videoWrapRef  = useRef<HTMLDivElement>(null)
  const hasResizedVideoRef = useRef(false)
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

  // Auto-refresh when the active stream, live state, or YouTube link changes.
  useEffect(() => {
    const supabase = createClient()
    const refresh = () => { router.refresh() }
    const statusChannel = supabase
      .channel('stream-status')
      .on('broadcast', { event: 'stream_live' }, refresh)
      .on('broadcast', { event: 'stream_ended' }, refresh)
      .on('broadcast', { event: 'stream_updated' }, refresh)
      .subscribe()
    const currentStreamChannel = stream?.id
      ? supabase
          .channel(`stream:${stream.id}`)
          .on('broadcast', { event: 'stream_live' }, refresh)
          .on('broadcast', { event: 'stream_ended' }, refresh)
          .on('broadcast', { event: 'stream_updated' }, refresh)
          .subscribe()
      : null

    return () => {
      supabase.removeChannel(statusChannel)
      if (currentStreamChannel) supabase.removeChannel(currentStreamChannel)
    }
  }, [stream?.id, router])

  // Realtime can be missed if a tab sleeps. Poll lightly as a safety net.
  useEffect(() => {
    let isDisposed = false
    const checkForStreamChange = async () => {
      try {
        const res = await fetch('/api/stream/sync', { cache: 'no-store' })
        if (!res.ok || isDisposed) return

        const data = await res.json() as {
          is_live?: boolean
          stream_id?: string
          youtube_video_id?: string
        }

        const activeStreamChanged =
          data.is_live === true &&
          (data.stream_id !== stream?.id || data.youtube_video_id !== stream?.youtube_video_id)
        const activeStreamEnded = !!stream?.is_live && data.is_live === false
        const streamCameOnline = !stream?.is_live && data.is_live === true

        if (activeStreamChanged || activeStreamEnded || streamCameOnline) {
          router.refresh()
        }
      } catch {
        // The next interval will try again.
      }
    }

    const interval = window.setInterval(checkForStreamChange, 10000)
    return () => {
      isDisposed = true
      window.clearInterval(interval)
    }
  }, [stream?.id, stream?.is_live, stream?.youtube_video_id, router])

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

  return (
    <div className="flex min-h-[100dvh] flex-col lg:h-screen lg:overflow-hidden">
      <Header member={member} stream={stream} />
      {resizeMode && (
        <div
          className="fixed inset-0 z-[9999]"
          style={{ cursor: resizeMode === 'chat' ? 'col-resize' : 'row-resize' }}
        />
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

      {/* ── Main layout ───────────────────────────────── */}
      <div ref={mainLayoutRef} className="flex flex-1 flex-col gap-0 lg:min-h-0 lg:flex-row lg:overflow-hidden">

        {/* ── Left column: Video + Tabs ── */}
        <div ref={leftColumnRef} className="flex min-w-0 flex-col lg:min-h-0 lg:flex-1 lg:overflow-hidden">

          {/* Video player */}
          <div
            ref={videoWrapRef}
            className="relative w-full max-w-[1920px] mx-auto flex-shrink-0 bg-black"
            style={isDesktop ? { height: videoHeight } : undefined}
          >
            <VideoPlayer stream={stream} fill={isDesktop} />
            <EmojiOverlay emojis={floatingEmojis} />
          </div>

          {/* ── Horizontal drag handle (video ↕ tabs) ── */}
          <HorizontalDivider onPointerDown={(e) => startResize('bottom', e)} />

          {/* Below video: tabs */}
          <div
            className="flex-1 p-3 pb-6 sm:p-4 lg:min-h-0 lg:overflow-y-auto lg:p-6"
          >
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

            <Tabs defaultValue="setlist">
              <TabsList className="glass mb-4 grid w-full grid-cols-2 sm:inline-flex sm:w-auto">
                <TabsTrigger value="setlist" className="flex items-center justify-center gap-2">
                  <Music2 className="w-3.5 h-3.5" />
                  <span>Programme</span>
                </TabsTrigger>
                <TabsTrigger value="comments" className="flex items-center justify-center gap-2">
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>Leave a Note</span>
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
            </Tabs>
          </div>
        </div>

        {/* ── Horizontal drag handle (left ↔ chat) ── */}
        <VerticalDivider onPointerDown={(e) => startResize('chat', e)} />

        {/* ── Right: Chat panel ── */}
        <div
          className="flex h-[min(70dvh,560px)] min-h-[420px] flex-col border-t border-border/50 lg:h-auto lg:min-h-0 lg:border-l lg:border-t-0"
          style={isDesktop
            ? { width: chatWidth, flexShrink: 0 }
            : { width: '100%' }
          }
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
          <ChatPanel
            key={stream?.id ?? 'waiting-room'}
            member={member}
            stream={stream}
            initialMessages={initialMessages}
            memberDirectory={memberDirectory}
            isMuted={isMuted}
            onEmojiReaction={addFloatingEmoji}
            onTipBanner={setTipBanner}
          />
        </div>

      </div>
    </div>
  )
}
