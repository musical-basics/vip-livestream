'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase-client'
import type { Member, Stream, ChatMessage } from '@/lib/database.types'
import ChatMessageRow from './ChatMessageRow'
import EmojiPicker from './EmojiPicker'
import DisplayNameEditor from './DisplayNameEditor'
import { Button } from '@/components/ui/button'
import { Loader2, Send, Smile, ChevronUp, Users } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

const PAGE_SIZE = 50

interface ChatPanelProps {
  member: Member
  stream: Stream | null
  initialMessages: ChatMessage[]
  isMuted: boolean
  onEmojiReaction: (emoji: string) => void
  onTipBanner: (tip: { name: string; amount: number; message?: string }) => void
}

export default function ChatPanel({
  member,
  stream,
  initialMessages,
  isMuted: initialMuted,
  onEmojiReaction,
  onTipBanner,
}: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
  const [input, setInput] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [isMuted, setIsMuted] = useState(initialMuted)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(initialMessages.length >= PAGE_SIZE)
  const [onlineCount, setOnlineCount] = useState(1)
  const [displayName, setDisplayName] = useState(member.display_name || member.name)
  const [mutedMessageIds, setMutedMessageIds] = useState<Set<string>>(new Set())

  const scrollRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  // Auto-scroll to bottom on new messages
  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages.length, scrollToBottom])

  // Realtime subscriptions
  useEffect(() => {
    if (!stream?.id) return

    const channel = supabase
      .channel(`stream:${stream.id}`)
      .on('broadcast', { event: 'new_message' }, ({ payload }) => {
        const msg = payload as ChatMessage
        setMessages((prev) => {
          if (prev.find((m) => m.id === msg.id)) return prev
          return [...prev, msg]
        })
      })
      .on('broadcast', { event: 'mute_message' }, ({ payload }) => {
        const { message_id } = payload as { message_id: string }
        setMutedMessageIds((prev) => new Set([...prev, message_id]))
      })
      .on('broadcast', { event: 'member_muted' }, ({ payload }) => {
        const { member_id } = payload as { member_id: string }
        if (member_id === member.id) {
          setIsMuted(true)
        }
      })
      .on('broadcast', { event: 'tip_received' }, ({ payload }) => {
        onTipBanner(payload as { name: string; amount: number; message?: string })
      })
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        setOnlineCount(Object.keys(state).length)
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            member_id: member.id,
            display_name: displayName,
          })
        }
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [stream?.id, member.id, displayName, onTipBanner])

  // Load older messages (scroll up pagination)
  async function loadMore() {
    if (!stream?.id || isLoadingMore || !hasMore) return
    const oldestMsg = messages[0]
    if (!oldestMsg) return

    setIsLoadingMore(true)
    try {
      const { data } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('stream_id', stream.id)
        .eq('is_muted', false)
        .lt('created_at', oldestMsg.created_at)
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE)

      if (data && data.length > 0) {
        setMessages((prev) => [...data.reverse(), ...prev])
        setHasMore(data.length >= PAGE_SIZE)
        // Restore scroll position (don't jump to bottom)
        const container = scrollRef.current
        if (container) {
          const prevHeight = container.scrollHeight
          setTimeout(() => {
            container.scrollTop = container.scrollHeight - prevHeight
          }, 0)
        }
      } else {
        setHasMore(false)
      }
    } finally {
      setIsLoadingMore(false)
    }
  }

  async function sendMessage(content?: string, emoji?: string) {
    if (!stream?.id) return
    if (isMuted) return
    const msgContent = content ?? input.trim()
    if (!msgContent && !emoji) return

    setIsSending(true)
    setInput('')

    try {
      const res = await fetch('/api/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stream_id: stream.id,
          content: emoji ? null : msgContent,
          emoji: emoji || null,
          display_name: displayName,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        console.error('Send error:', err)
      }
    } finally {
      setIsSending(false)
    }
  }

  function handleEmojiSelect(emoji: string) {
    setShowEmojiPicker(false)
    // Send as floating reaction visible to all
    onEmojiReaction(emoji)
    sendMessage(undefined, emoji)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="flex flex-col flex-1 h-full min-h-0 max-h-[calc(100vh-56px)] lg:max-h-none">
      {/* Online count + display name */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border/30">
        <DisplayNameEditor
          member={member}
          displayName={displayName}
          onChange={setDisplayName}
        />
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Users className="w-3 h-3" />
          <span>{onlineCount}</span>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-3 space-y-1 min-h-0"
      >
        {/* Load more button */}
        {hasMore && (
          <button
            onClick={loadMore}
            disabled={isLoadingMore}
            className="w-full flex items-center justify-center gap-2 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {isLoadingMore ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <ChevronUp className="w-3 h-3" />
            )}
            {isLoadingMore ? 'Loading…' : 'Load earlier messages'}
          </button>
        )}

        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full py-12 text-center">
            <span className="text-3xl mb-3">🎹</span>
            <p className="text-sm text-muted-foreground">Be the first to say hello!</p>
          </div>
        )}

        {messages.map((msg) => (
          <ChatMessageRow
            key={msg.id}
            message={msg}
            currentMember={member}
            isMuted={mutedMessageIds.has(msg.id)}
            streamId={stream?.id}
          />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Emoji picker overlay */}
      {showEmojiPicker && (
        <div className="border-t border-border/30">
          <EmojiPicker onSelect={handleEmojiSelect} onClose={() => setShowEmojiPicker(false)} />
        </div>
      )}

      {/* Input area */}
      <div className="border-t border-border/30 p-3 glass-heavy">
        {isMuted ? (
          <div className="text-center py-3">
            <p className="text-xs text-muted-foreground">
              🔇 You are currently muted by a moderator
            </p>
          </div>
        ) : (
          <div className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Say something…"
              rows={1}
              maxLength={500}
              className="flex-1 resize-none bg-white/5 rounded-xl px-3 py-2.5 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-[oklch(0.75_0.12_85)] border border-white/8 min-h-[40px] max-h-[100px] overflow-y-auto"
              style={{ fieldSizing: 'content' } as any}
            />
            <button
              onClick={() => setShowEmojiPicker((v) => !v)}
              className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 transition-colors border border-white/8 text-muted-foreground hover:text-foreground"
              title="Emoji reactions"
            >
              <Smile className="w-4 h-4" />
            </button>
            <Button
              onClick={() => sendMessage()}
              disabled={isSending || !input.trim()}
              size="sm"
              className="rounded-xl px-3 py-2.5 h-auto"
              style={{
                background: input.trim()
                  ? 'linear-gradient(135deg, oklch(0.75 0.12 85), oklch(0.60 0.10 70))'
                  : undefined,
              }}
            >
              {isSending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
