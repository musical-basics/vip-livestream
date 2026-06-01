'use client'

import { useState, useEffect, useRef } from 'react'
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

interface WatchPageClientProps {
  member: Member
  stream: Stream | null
  initialMessages: ChatMessage[]
  initialComments: Comment[]
  isMuted: boolean
}

export default function WatchPageClient({
  member,
  stream,
  initialMessages,
  initialComments,
  isMuted,
}: WatchPageClientProps) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [floatingEmojis, setFloatingEmojis] = useState<Array<{ id: string; emoji: string; x: number }>>([])
  const [tipBanner, setTipBanner] = useState<{ name: string; amount: number; message?: string } | null>(null)

  // Auto-refresh page when stream goes live or ends
  useEffect(() => {
    if (!stream?.id) return
    const supabase = createClient()
    const channel = supabase
      .channel(`stream-status:${stream.id}`)
      .on('broadcast', { event: 'stream_live' }, () => {
        router.refresh()
      })
      .on('broadcast', { event: 'stream_ended' }, () => {
        router.refresh()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [stream?.id, router])

  // Show tip success notification
  useEffect(() => {
    if (searchParams.get('tip_success')) {
      setTipBanner({
        name: member.display_name || member.name,
        amount: 0, // we show generic success here; actual amount comes from webhook
        message: 'Thank you for your support! 💝',
      })
      // Clean up URL
      router.replace('/watch')
      setTimeout(() => setTipBanner(null), 5000)
    }
  }, [searchParams, member, router])

  function addFloatingEmoji(emoji: string) {
    const id = `${Date.now()}-${Math.random()}`
    const x = 10 + Math.random() * 80 // random horizontal position %
    setFloatingEmojis((prev) => [...prev, { id, emoji, x }])
    setTimeout(() => {
      setFloatingEmojis((prev) => prev.filter((e) => e.id !== id))
    }, 2600)
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header member={member} stream={stream} />

      {/* Tip banner notification */}
      {tipBanner && (
        <TipBanner
          name={tipBanner.name}
          amount={tipBanner.amount}
          message={tipBanner.message}
          onClose={() => setTipBanner(null)}
        />
      )}

      {/* Main layout */}
      <div className="flex flex-1 flex-col lg:flex-row gap-0 overflow-hidden">
        {/* Left: Video + Tabs */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Video player */}
          <div className="relative">
            <VideoPlayer stream={stream} />
            {/* Floating emoji overlay */}
            <EmojiOverlay emojis={floatingEmojis} />
          </div>

          {/* Below video: tabs for Setlist + Comments */}
          <div className="flex-1 p-4 lg:p-6">
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
                {stream && (
                  <CommentSection
                    member={member}
                    stream={stream}
                    initialComments={initialComments}
                  />
                )}
              </TabsContent>
            </Tabs>
          </div>
        </div>

        {/* Right: Chat panel */}
        <div className="w-full lg:w-[380px] xl:w-[420px] flex flex-col border-t lg:border-t-0 lg:border-l border-border/50">
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
            isMuted={isMuted}
            onEmojiReaction={addFloatingEmoji}
            onTipBanner={setTipBanner}
          />
        </div>
      </div>
    </div>
  )
}
