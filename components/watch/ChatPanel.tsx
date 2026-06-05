'use client'

import { useState, useEffect, useRef, useCallback, useMemo, type CSSProperties } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { createClient } from '@/lib/supabase-client'
import type { Member, Stream, ChatMessage } from '@/lib/database.types'
import ChatMessageRow from './ChatMessageRow'
import EmojiPicker from './EmojiPicker'
import DisplayNameEditor from './DisplayNameEditor'
import { Button } from '@/components/ui/button'
import { Loader2, Send, Smile, Users, Pin, X } from 'lucide-react'
import EmojiOverlay from './EmojiOverlay'
import { canModerateChat, roleLabel } from '@/lib/roles'
import { DEFAULT_SLOW_MODE_DELAY_SECONDS } from '@/lib/chat-settings'

const PAGE_SIZE = 50
const MAX_MESSAGES_IN_MEMORY = 1000
const AUTO_SCROLL_THRESHOLD_PX = 96
const LOAD_MORE_SCROLL_THRESHOLD_PX = 80
const textareaAutoSizeStyle: CSSProperties & { fieldSizing?: string } = { fieldSizing: 'content' }

function appendMessage(messages: ChatMessage[], message: ChatMessage, currentMemberId?: string) {
  if (messages.find((existing) => existing.id === message.id)) return messages
  let next = messages
  if (currentMemberId && message.member_id === currentMemberId) {
    next = messages.filter(
      (m) =>
        !(
          m.id.startsWith('temp-') &&
          m.content === message.content &&
          m.emoji === message.emoji
        )
    )
  }
  next = [...next, message]
  return next.length > MAX_MESSAGES_IN_MEMORY ? next.slice(-MAX_MESSAGES_IN_MEMORY) : next
}

const EMOTICON_MAP: Record<string, string> = {
  '<3': '❤️',
  ':lol:': '😂',
  ':fire:': '🔥',
  ':clap:': '👏',
  ':applause:': '👏',
  ':piano:': '🎹',
  ':star:': '⭐',
  ':heart:': '❤️',
  ':O': '😮',
  ':o': '😮',
  ':-O': '😮',
  ':D': '😀',
  ':-D': '😃',
  ':)': '🙂',
  ':-)': '🙂',
  ';)': '😉',
  ';-)': '😉',
  ':(': '🙁',
  ':-(': '🙁',
  ':/': '😕',
  ':\\': '😕',
  ':P': '😛',
  ':p': '😛',
  'xD': '😆',
  'XD': '😆',
  'B)': '😎',
  'B-)': '😎',
}

function replaceEmoticons(text: string): string {
  if (!text) return text
  return text
    .split(/(\s+)/)
    .map((token) => {
      if (/^\s+$/.test(token)) return token

      if (EMOTICON_MAP[token]) {
        return EMOTICON_MAP[token]
      }

      const lastChar = token.slice(-1)
      if (['.', ',', '!', '?'].includes(lastChar)) {
        const stem = token.slice(0, -1)
        if (EMOTICON_MAP[stem]) {
          return EMOTICON_MAP[stem] + lastChar
        }
      }
      return token
    })
    .join('')
}

interface ChatPanelProps {
  member: Member
  stream: Stream | null
  initialMessages: ChatMessage[]
  memberDirectory: Member[]
  isMuted: boolean
  onEmojiReaction: (emoji: string) => void
  onTipBanner: (tip: { name: string; amount: number; message?: string }) => void
  highlightNameEditor?: boolean
}

export default function ChatPanel({
  member,
  stream,
  initialMessages,
  memberDirectory,
  isMuted: initialMuted,
  onEmojiReaction,
  onTipBanner,
  highlightNameEditor = false,
}: ChatPanelProps) {
  const streamId = stream?.id
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
  const [input, setInput] = useState(() => {
    if (typeof window !== 'undefined' && streamId) {
      return localStorage.getItem(`draft_chat_${streamId}`) || ''
    }
    return ''
  })
  const [isSending, setIsSending] = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [applauseCooldown, setApplauseCooldown] = useState(false)
  const [isMuted, setIsMuted] = useState(initialMuted)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(initialMessages.length >= PAGE_SIZE)
  const [onlineCount, setOnlineCount] = useState(1)
  const [displayName, setDisplayName] = useState(member.display_name || member.name)
  const [mutedMessageIds, setMutedMessageIds] = useState<Set<string>>(new Set())
  const [chatFloatingEmojis, setChatFloatingEmojis] = useState<Array<{ id: string; emoji: string; x: number; delay: number }>>([])
  const [pinnedMessage, setPinnedMessage] = useState<ChatMessage | null>(
    () => (stream?.pinned_message as unknown as ChatMessage) || null
  )
  const [slowModeDelay, setSlowModeDelay] = useState(stream?.slow_mode_delay ?? DEFAULT_SLOW_MODE_DELAY_SECONDS)
  const [isUpdatingSlowMode, setIsUpdatingSlowMode] = useState(false)
  const [cooldownRemaining, setCooldownRemaining] = useState(0)
  const [activeMenuMessageId, setActiveMenuMessageId] = useState<string | null>(null)
  const [activeMenuPosition, setActiveMenuPosition] = useState<{ x: number; y: number } | null>(null)
  const handleActiveMenuChange = useCallback(
    (messageId: string | null, position: { x: number; y: number } | null) => {
      setActiveMenuMessageId(messageId)
      setActiveMenuPosition(position)
    },
    []
  )

  useEffect(() => {
    if (cooldownRemaining <= 0) return
    const timer = setTimeout(() => {
      setCooldownRemaining((prev) => prev - 1)
    }, 1000)
    return () => clearTimeout(timer)
  }, [cooldownRemaining])

  useEffect(() => {
    if (!activeMenuMessageId) return

    function handleGlobalClose(e: Event) {
      if ((e.target as Element).closest('.mod-menu-container')) {
        return
      }
      setActiveMenuMessageId(null)
      setActiveMenuPosition(null)
    }

    window.addEventListener('pointerdown', handleGlobalClose, true)
    window.addEventListener('contextmenu', handleGlobalClose, true)

    return () => {
      window.removeEventListener('pointerdown', handleGlobalClose, true)
      window.removeEventListener('contextmenu', handleGlobalClose, true)
    }
  }, [activeMenuMessageId])

  const spawnEmojiBurst = useCallback((emoji: string, count = 6) => {
    setChatFloatingEmojis((prev) => {
      if (prev.length >= 60) return prev

      const newEmojis = Array.from({ length: count }).map((_, i) => ({
        id: `${Date.now()}-${i}-${Math.random()}`,
        emoji,
        x: 10 + Math.random() * 80,
        delay: Math.random() * 0.5,
      }))

      setTimeout(() => {
        setChatFloatingEmojis((curr) =>
          curr.filter((e) => !newEmojis.find((ne) => ne.id === e.id))
        )
      }, 3000)

      return [...prev, ...newEmojis]
    })
  }, [])

  const scrollRef = useRef<HTMLDivElement>(null)
  const shouldAutoScrollRef = useRef(true)
  const scrollFrameRef = useRef<number | null>(null)
  const supabase = useMemo(() => createClient(), [])
  const memberById = useMemo(() => {
    const map = new Map(memberDirectory.map((directoryMember) => [directoryMember.id, directoryMember]))
    map.set(member.id, member)
    return map
  }, [memberDirectory, member])

  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Virtual manages mutable measurements internally.
  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 64,
    anchorTo: 'end',
    followOnAppend: true,
  })

  // Auto-scroll to bottom on new messages
  const scrollToBottom = useCallback(() => {
    if (!shouldAutoScrollRef.current || messages.length === 0) return
    virtualizer.scrollToIndex(messages.length - 1)
  }, [messages.length, virtualizer])

  useEffect(() => {
    scrollToBottom()
  }, [messages.length, scrollToBottom])

  useEffect(() => () => {
    if (scrollFrameRef.current !== null) {
      window.cancelAnimationFrame(scrollFrameRef.current)
    }
  }, [])

  // Load older messages (scroll up pagination)
  const loadMore = useCallback(async () => {
    if (!streamId || isLoadingMore || !hasMore) return
    const oldestMsg = messages[0]
    if (!oldestMsg) return

    shouldAutoScrollRef.current = false
    setIsLoadingMore(true)
    try {
      const { data } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('stream_id', streamId)
        .eq('is_muted', false)
        .lt('created_at', oldestMsg.created_at)
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE)

      if (data && data.length > 0) {
        setMessages((prev) => {
          const next = [...data.reverse(), ...prev]
          return next.length > MAX_MESSAGES_IN_MEMORY ? next.slice(0, MAX_MESSAGES_IN_MEMORY) : next
        })
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
  }, [hasMore, isLoadingMore, messages, streamId, supabase])

  const handleScroll = useCallback(() => {
    const container = scrollRef.current
    if (!container) return
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight
    shouldAutoScrollRef.current = distanceFromBottom < AUTO_SCROLL_THRESHOLD_PX

    if (container.scrollTop <= LOAD_MORE_SCROLL_THRESHOLD_PX) {
      void loadMore()
    }
  }, [loadMore])

  // Realtime subscriptions
  useEffect(() => {
    if (!streamId) return

    const channel = supabase
      .channel(`stream:${streamId}`)
      .on('broadcast', { event: 'new_message' }, ({ payload }) => {
        const msg = payload as ChatMessage
        setMessages((prev) => appendMessage(prev, msg, member.id))
        if (!msg.content && msg.emoji) {
          if (msg.emoji === '👏') {
            spawnEmojiBurst('👏', 5)
          } else {
            spawnEmojiBurst(msg.emoji, 3)
          }
          onEmojiReaction(msg.emoji)
        }
      })
      .on('broadcast', { event: 'mute_message' }, ({ payload }) => {
        const { message_id } = payload as { message_id: string }
        setMutedMessageIds((prev) => new Set([...prev, message_id]))
      })
      .on('broadcast', { event: 'delete_message' }, ({ payload }) => {
        const { message_id } = payload as { message_id: string }
        setMessages((prev) => prev.filter((message) => message.id !== message_id))
        setMutedMessageIds((prev) => {
          const next = new Set(prev)
          next.delete(message_id)
          return next
        })
      })
      .on('broadcast', { event: 'member_muted' }, ({ payload }) => {
        const { member_id } = payload as { member_id: string }
        if (member_id === member.id) {
          setIsMuted(true)
        }
      })
      .on('broadcast', { event: 'message_reaction' }, ({ payload }) => {
        const { message_id, reactions } = payload as { message_id: string; reactions: Record<string, string[]> }
        setMessages((prev) =>
          prev.map((msg) => {
            if (msg.id === message_id) {
              const prevReactions = msg.reactions || {}
              Object.keys(reactions).forEach((emoji) => {
                const prevCount = prevReactions[emoji]?.length || 0
                const nextCount = reactions[emoji]?.length || 0
                if (nextCount > prevCount) {
                  spawnEmojiBurst(emoji, 3)
                }
              })
              return { ...msg, reactions }
            }
            return msg
          })
        )
      })
      .on('broadcast', { event: 'pinned_message_updated' }, ({ payload }) => {
        const { pinned_message } = payload as { pinned_message: ChatMessage | null }
        setPinnedMessage(pinned_message)
      })
      .on('broadcast', { event: 'slow_mode_updated' }, ({ payload }) => {
        const { slow_mode_delay } = payload as { slow_mode_delay: number }
        setSlowModeDelay(slow_mode_delay)
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
  }, [streamId, member.id, displayName, onTipBanner, supabase, spawnEmojiBurst, onEmojiReaction])

  const sendMessage = useCallback(async (content?: string, emoji?: string) => {
    if (!streamId) return
    if (isMuted) return
    if (isSending) return
    const msgContent = replaceEmoticons(content ?? input.trim())
    if (!msgContent && !emoji) return

    const tempId = `temp-${Date.now()}-${Math.random()}`
    const optimisticMessage: ChatMessage & { status?: 'sending' | 'failed' | 'sent' } = {
      id: tempId,
      stream_id: streamId,
      member_id: member.id,
      content: emoji ? null : msgContent,
      emoji: emoji || null,
      display_name: displayName,
      created_at: new Date().toISOString(),
      is_muted: false,
      reactions: {},
      status: 'sending',
    }

    setMessages((prev) => appendMessage(prev, optimisticMessage, member.id))

    setIsSending(true)
    setInput('')
    if (streamId) {
      localStorage.removeItem(`draft_chat_${streamId}`)
    }

    try {
      const res = await fetch('/api/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stream_id: streamId,
          content: emoji ? null : msgContent,
          emoji: emoji || null,
          display_name: displayName,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        console.error('Send error:', data)
        setMessages((prev) =>
          prev.map((msg) => (msg.id === tempId ? { ...msg, status: 'failed' } : msg))
        )
        return
      }

      if (data.message) {
        shouldAutoScrollRef.current = true
        setMessages((prev) =>
          prev.map((msg) => (msg.id === tempId ? { ...data.message, status: 'sent' } : msg))
        )
        if (slowModeDelay > 0 && !canModerateChat(member)) {
          setCooldownRemaining(slowModeDelay)
        }
      }
    } catch (err) {
      console.error('Send error:', err)
      setMessages((prev) =>
        prev.map((msg) => (msg.id === tempId ? { ...msg, status: 'failed' } : msg))
      )
    } finally {
      setIsSending(false)
    }
  }, [displayName, input, isMuted, isSending, streamId, slowModeDelay, member])

  const updateSlowMode = useCallback(async (delay: number) => {
    if (!streamId || isUpdatingSlowMode) return
    setIsUpdatingSlowMode(true)
    try {
      const res = await fetch('/api/mod/slow-mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stream_id: streamId,
          slow_mode_delay: delay,
        }),
      })
      if (!res.ok) {
        console.error('Failed to update slow mode')
      }
    } catch (err) {
      console.error(err)
    } finally {
      setIsUpdatingSlowMode(false)
    }
  }, [streamId, isUpdatingSlowMode])

  function handleEmojiSelect(emoji: string) {
    setShowEmojiPicker(false)
    // Send as floating reaction visible to all
    onEmojiReaction(emoji)
    sendMessage(undefined, emoji)
  }

  const handleApplauseClick = useCallback(() => {
    if (!streamId || applauseCooldown) return
    setApplauseCooldown(true)

    onEmojiReaction('👏')
    sendMessage(undefined, '👏')
    spawnEmojiBurst('👏', 5)

    setTimeout(() => {
      setApplauseCooldown(false)
    }, 1000)
  }, [streamId, applauseCooldown, onEmojiReaction, sendMessage, spawnEmojiBurst])

  const handleMessageDeleted = useCallback((messageId: string) => {
    setMessages((prev) => prev.filter((message) => message.id !== messageId))
  }, [])

  const handleMessageReacted = useCallback((messageId: string, reactions: Record<string, string[]>) => {
    setMessages((prev) =>
      prev.map((msg) => {
        if (msg.id === messageId) {
          const prevReactions = msg.reactions || {}
          Object.keys(reactions).forEach((emoji) => {
            const prevCount = prevReactions[emoji]?.length || 0
            const nextCount = reactions[emoji]?.length || 0
            if (nextCount > prevCount) {
              spawnEmojiBurst(emoji, 6)
            }
          })
          return { ...msg, reactions }
        }
        return msg
      })
    )
  }, [spawnEmojiBurst])

  const handlePinToggle = useCallback(async (msg: ChatMessage) => {
    if (!streamId) return
    const isCurrentlyPinned = pinnedMessage?.id === msg.id
    const targetMessageId = isCurrentlyPinned ? null : msg.id

    // Optimistic update
    setPinnedMessage(isCurrentlyPinned ? null : msg)

    try {
      const res = await fetch('/api/mod/pin-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message_id: targetMessageId,
          stream_id: streamId,
        }),
      })
      if (!res.ok) {
        setPinnedMessage(pinnedMessage)
      }
    } catch {
      setPinnedMessage(pinnedMessage)
    }
  }, [streamId, pinnedMessage])

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter') {
      const isMobile = typeof window !== 'undefined' && /Mobi|Android/i.test(navigator.userAgent)
      if (isMobile || !e.shiftKey) {
        e.preventDefault()
        if (cooldownRemaining > 0 && !canModerateChat(member)) return
        sendMessage()
      }
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col relative">
      {/* Online count + display name */}
      <div className="flex items-center justify-between border-b border-border/30 px-3 py-2 sm:px-4">
        <DisplayNameEditor
          member={member}
          displayName={displayName}
          onChange={setDisplayName}
          highlight={highlightNameEditor}
        />
        <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
          {canModerateChat(member) && (
            <div className="flex items-center gap-1.5 bg-white/5 border border-white/8 rounded-lg px-2 py-0.5 text-xs text-muted-foreground focus-within:ring-1 focus-within:ring-gold/50">
              <span className="text-[10px] uppercase tracking-wider font-semibold text-gold/80">Slow</span>
              <select
                value={slowModeDelay}
                onChange={(e) => updateSlowMode(Number(e.target.value))}
                disabled={isUpdatingSlowMode}
                className="bg-transparent text-foreground font-medium outline-none cursor-pointer border-none p-0 pr-1 text-xs"
              >
                <option value={0} className="bg-popover text-foreground">Off</option>
                <option value={3} className="bg-popover text-foreground">3s</option>
                <option value={5} className="bg-popover text-foreground">5s</option>
                <option value={10} className="bg-popover text-foreground">10s</option>
                <option value={30} className="bg-popover text-foreground">30s</option>
                <option value={60} className="bg-popover text-foreground">60s</option>
              </select>
            </div>
          )}
          <div className="flex items-center gap-1">
            <Users className="w-3 h-3" />
            <span>{onlineCount}</span>
          </div>
        </div>
      </div>

      {/* Pinned message banner */}
      {pinnedMessage && (
        <div className="flex items-start gap-2 border-b border-gold/20 bg-gold/5 px-4 py-2.5 text-xs animate-[slideInDown_0.2s_ease-out] relative z-10">
          <Pin className="w-3.5 h-3.5 text-gold shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-gold/80 font-medium tracking-wide uppercase leading-none mb-1">
              Pinned Message
            </p>
            <p className="text-foreground/90 font-medium truncate leading-normal">
              <span className="font-semibold text-gold mr-1.5">{pinnedMessage.display_name}:</span>
              {pinnedMessage.content || pinnedMessage.emoji}
            </p>
          </div>
          {canModerateChat(member) && (
            <button
              onClick={() => handlePinToggle(pinnedMessage)}
              className="p-1 rounded hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors"
              title="Unpin message"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Messages */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="min-h-0 flex-1 overscroll-contain overflow-y-auto p-3 relative"
      >
        {isLoadingMore && (
          <div className="flex items-center justify-center gap-2 py-2 text-xs text-muted-foreground">
            <Loader2 className="w-3 h-3 animate-spin" />
            Loading earlier messages
          </div>
        )}

        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-12 text-center">
            <span className="text-3xl mb-3">🎹</span>
            <p className="text-sm text-muted-foreground">Be the first to say hello!</p>
          </div>
        ) : (
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {virtualizer.getVirtualItems().map((virtualItem) => {
              const msg = messages[virtualItem.index]
              if (!msg) return null
              const sender = memberById.get(msg.member_id)
              return (
                <div
                  key={virtualItem.key}
                  ref={virtualizer.measureElement}
                  data-index={virtualItem.index}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualItem.start}px)`,
                  }}
                >
                  <ChatMessageRow
                    message={msg}
                    currentMember={member}
                    senderBadges={sender?.access_badges}
                    senderRole={roleLabel(sender)}
                    isMuted={mutedMessageIds.has(msg.id)}
                    streamId={streamId}
                    onDeleted={handleMessageDeleted}
                    isPinned={pinnedMessage?.id === msg.id}
                    onPinToggle={handlePinToggle}
                    onReacted={handleMessageReacted}
                    isMenuOpen={activeMenuMessageId === msg.id}
                    activeMenuPosition={activeMenuMessageId === msg.id ? activeMenuPosition : null}
                    setActiveMenu={handleActiveMenuChange}
                  />
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Emoji picker overlay */}
      {showEmojiPicker && (
        <div className="border-t border-border/30">
          <EmojiPicker onSelect={handleEmojiSelect} onClose={() => setShowEmojiPicker(false)} />
        </div>
      )}

      {/* Input area */}
      <div className="glass-heavy border-t border-border/30 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        {isMuted ? (
          <div className="text-center py-3">
            <p className="text-xs text-muted-foreground">
              🔇 You are currently muted by a moderator
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {slowModeDelay > 0 && (
              <div className="flex items-center gap-1.5 px-1 text-[11px] text-muted-foreground">
                <span className="text-gold/90 font-medium">🐢 Slow Mode:</span>
                <span>One message every {slowModeDelay}s</span>
                {canModerateChat(member) ? (
                  <span className="text-gold/60 font-semibold ml-1.5">(Exempt)</span>
                ) : cooldownRemaining > 0 ? (
                  <span className="ml-auto text-gold font-semibold animate-pulse">Wait {cooldownRemaining}s</span>
                ) : null}
              </div>
            )}
            <div className="flex items-end gap-2">
              <textarea
                value={input}
                onChange={(e) => {
                  const val = e.target.value
                  const isMobile = typeof window !== 'undefined' && /Mobi|Android/i.test(navigator.userAgent)

                  if (isMobile && val.includes('\n')) {
                    const cleaned = val.replace(/\n/g, '')
                    if (cooldownRemaining > 0 && !canModerateChat(member)) {
                      setInput(cleaned)
                      if (streamId) {
                        localStorage.setItem(`draft_chat_${streamId}`, cleaned)
                      }
                      return
                    }
                    if (cleaned.trim()) {
                      sendMessage(cleaned)
                    } else {
                      setInput('')
                      if (streamId) {
                        localStorage.removeItem(`draft_chat_${streamId}`)
                      }
                    }
                    return
                  }

                  setInput(val)
                  if (streamId) {
                    localStorage.setItem(`draft_chat_${streamId}`, val)
                  }
                }}
                onKeyDown={handleKeyDown}
                placeholder="Say something…"
                disabled={!streamId}
                rows={1}
                maxLength={500}
                className="min-h-[44px] flex-1 resize-none rounded-xl border border-white/8 bg-white/5 px-3 py-2.5 text-base placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-[oklch(0.75_0.12_85)] disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm max-h-[100px] overflow-y-auto"
                style={textareaAutoSizeStyle}
              />
              <button
                onClick={handleApplauseClick}
                disabled={!streamId || applauseCooldown || (cooldownRemaining > 0 && !canModerateChat(member))}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/8 bg-white/5 text-amber-400 hover:text-amber-300 transition-all hover:scale-105 active:scale-95 duration-100 disabled:opacity-40 disabled:cursor-not-allowed"
                title="Applause reaction (👏)"
              >
                <span className={`text-lg transition-transform ${applauseCooldown || (cooldownRemaining > 0 && !canModerateChat(member)) ? 'scale-75 opacity-50' : ''}`}>👏</span>
              </button>
              <button
                onClick={() => setShowEmojiPicker((v) => !v)}
                disabled={!streamId}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/8 bg-white/5 text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground"
                title="Emoji reactions"
              >
                <Smile className="w-4 h-4" />
              </button>
              <Button
                onClick={() => sendMessage()}
                disabled={isSending || !input.trim() || !streamId || (cooldownRemaining > 0 && !canModerateChat(member))}
                size="sm"
                className="h-11 shrink-0 rounded-xl px-3"
                style={{
                  background: input.trim() && !(cooldownRemaining > 0 && !canModerateChat(member))
                    ? 'linear-gradient(135deg, oklch(0.75 0.12 85), oklch(0.60 0.10 70))'
                    : undefined,
                }}
              >
                {isSending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : cooldownRemaining > 0 && !canModerateChat(member) ? (
                  <span className="text-xs font-bold">{cooldownRemaining}s</span>
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
      {/* Floating emojis overlay for the chat panel */}
      <EmojiOverlay emojis={chatFloatingEmojis} />
    </div>
  )
}
