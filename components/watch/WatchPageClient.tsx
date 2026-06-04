'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'
import type { Member, Stream, ChatMessage, Comment } from '@/lib/database.types'
import VideoPlayer from './VideoPlayer'
import ChatPanel from './ChatPanel'
import SetlistPanel from './SetlistPanel'
import CommentSection from './CommentSection'
import TipButton from './TipButton'
import EmojiOverlay from './EmojiOverlay'
import Header from './Header'
import TipBanner from './TipBanner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { MessageSquare, Music2, MessageCircle } from 'lucide-react'

// ── Resize bounds ─────────────────────────────────────────────
const MIN_CHAT_WIDTH   = 260
const MAX_CHAT_WIDTH   = 720
const DEFAULT_CHAT_WIDTH = 400

const MIN_BOTTOM_HEIGHT   = 160
const MAX_BOTTOM_HEIGHT   = 700
const DEFAULT_BOTTOM_HEIGHT = 320

// ── Types ─────────────────────────────────────────────────────
interface WatchPageClientProps {
  member: Member
  stream: Stream | null
  initialMessages: ChatMessage[]
  initialComments: Comment[]
  memberDirectory: Member[]
  isMuted: boolean
}

// ── Drag handle components ────────────────────────────────────
function VerticalDivider({ onMouseDown }: { onMouseDown: (e: React.MouseEvent) => void }) {
  return (
    <div
      onMouseDown={onMouseDown}
      className="hidden lg:flex w-[6px] cursor-col-resize flex-col items-center justify-center flex-shrink-0 group relative z-10"
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

function HorizontalDivider({ onMouseDown }: { onMouseDown: (e: React.MouseEvent) => void }) {
  return (
    <div
      onMouseDown={onMouseDown}
      className="hidden lg:flex h-[6px] cursor-row-resize items-center justify-center flex-shrink-0 group relative z-10"
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
}: WatchPageClientProps) {
  const searchParams = useSearchParams()
  const router = useRouter()

  const [floatingEmojis, setFloatingEmojis] = useState<Array<{ id: string; emoji: string; x: number }>>([])
  const [tipBanner, setTipBanner]           = useState<{ name: string; amount: number; message?: string } | null>(null)

  // Resize state (desktop only)
  const [chatWidth, setChatWidth]       = useState(DEFAULT_CHAT_WIDTH)
  const [bottomHeight, setBottomHeight] = useState(DEFAULT_BOTTOM_HEIGHT)
  const [isDesktop, setIsDesktop]       = useState(false)

  // Drag tracking refs
  const isDraggingChat   = useRef(false)
  const isDraggingBottom = useRef(false)
  const lastMouseX       = useRef(0)
  const lastMouseY       = useRef(0)

  // Detect desktop breakpoint
  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 1024)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // Global drag event listeners (attached once)
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (isDraggingChat.current) {
        const dx = lastMouseX.current - e.clientX  // left = wider chat
        lastMouseX.current = e.clientX
        setChatWidth(w => Math.min(MAX_CHAT_WIDTH, Math.max(MIN_CHAT_WIDTH, w + dx)))
      }
      if (isDraggingBottom.current) {
        const dy = e.clientY - lastMouseY.current  // down = taller bottom panel
        lastMouseY.current = e.clientY
        setBottomHeight(h => Math.min(MAX_BOTTOM_HEIGHT, Math.max(MIN_BOTTOM_HEIGHT, h + dy)))
      }
    }
    const onMouseUp = () => {
      if (isDraggingChat.current || isDraggingBottom.current) {
        isDraggingChat.current   = false
        isDraggingBottom.current = false
        document.body.style.cursor     = ''
        document.body.style.userSelect = ''
      }
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup',   onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup',   onMouseUp)
    }
  }, [])

  const startChatDrag = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    isDraggingChat.current = true
    lastMouseX.current     = e.clientX
    document.body.style.cursor     = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [])

  const startBottomDrag = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    isDraggingBottom.current = true
    lastMouseY.current       = e.clientY
    document.body.style.cursor     = 'row-resize'
    document.body.style.userSelect = 'none'
  }, [])

  // Auto-refresh page when stream goes live or ends
  useEffect(() => {
    if (!stream?.id) return
    const supabase = createClient()
    const channel = supabase
      .channel(`stream-status:${stream.id}`)
      .on('broadcast', { event: 'stream_live' },  () => { router.refresh() })
      .on('broadcast', { event: 'stream_ended' }, () => { router.refresh() })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [stream?.id, router])

  // Show tip success notification
  useEffect(() => {
    if (searchParams.get('tip_success')) {
      setTipBanner({
        name: member.display_name || member.name,
        amount: 0,
        message: 'Thank you for your support! 💝',
      })
      router.replace('/watch')
      setTimeout(() => setTipBanner(null), 5000)
    }
  }, [searchParams, member, router])

  function addFloatingEmoji(emoji: string) {
    const id = `${Date.now()}-${Math.random()}`
    const x  = 10 + Math.random() * 80
    setFloatingEmojis(prev => [...prev, { id, emoji, x }])
    setTimeout(() => {
      setFloatingEmojis(prev => prev.filter(e => e.id !== id))
    }, 2600)
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header member={member} stream={stream} />

      {/* Tip banner */}
      {tipBanner && (
        <TipBanner
          name={tipBanner.name}
          amount={tipBanner.amount}
          message={tipBanner.message}
          onClose={() => setTipBanner(null)}
        />
      )}

      {/* ── Main layout ───────────────────────────────── */}
      <div className="flex flex-1 flex-col lg:flex-row gap-0 overflow-hidden">

        {/* ── Left column: Video + Tabs ── */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

          {/* Video player */}
          <div className="relative flex-shrink-0">
            <VideoPlayer stream={stream} />
            <EmojiOverlay emojis={floatingEmojis} />
          </div>

          {/* ── Vertical drag handle (video ↕ tabs) ── */}
          <HorizontalDivider onMouseDown={startBottomDrag} />

          {/* Below video: tabs */}
          <div
            className="overflow-y-auto p-4 lg:p-6"
            style={isDesktop ? { height: bottomHeight, flexShrink: 0 } : { flex: 1 }}
          >
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <div>
                <h2
                  className="text-2xl font-light text-gold"
                  style={{ fontFamily: "'Cormorant Garamond', serif" }}
                >
                  {stream?.title || 'VIP Piano Livestream'}
                </h2>
                {stream?.description && (
                  <p className="text-sm text-muted-foreground mt-1">{stream.description}</p>
                )}
              </div>
              <TipButton member={member} stream={stream} />
            </div>

            <Tabs defaultValue="setlist">
              <TabsList className="glass mb-4">
                <TabsTrigger value="setlist" className="flex items-center gap-2">
                  <Music2 className="w-3.5 h-3.5" />
                  <span>Programme</span>
                </TabsTrigger>
                <TabsTrigger value="comments" className="flex items-center gap-2">
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>Leave a Note</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="setlist">
                <SetlistPanel stream={stream} />
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
        <VerticalDivider onMouseDown={startChatDrag} />

        {/* ── Right: Chat panel ── */}
        <div
          className="flex flex-col border-t lg:border-t-0 lg:border-l border-border/50"
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
