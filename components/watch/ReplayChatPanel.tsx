'use client'

import { useState, useEffect, useRef, useCallback, useMemo, type RefObject } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { Member, ChatMessage } from '@/lib/database.types'
import { nameColor, roleLabel, ROLE_BADGE } from '@/lib/roles'
import { getMemberBadge, normalizeMemberBadges } from '@/lib/member-badges'
import { History } from 'lucide-react'

const TIME_POLL_MS = 500
const AUTO_SCROLL_THRESHOLD_PX = 96
// On a normal playback tick only a handful of messages appear at once; a big
// jump means the viewer seeked, where emoji bursts would be noise.
const MAX_BURST_REVEAL = 4

interface ReplayChatPanelProps {
  member: Member
  /** Every message of the stream, ascending by created_at. */
  messages: ChatMessage[]
  memberDirectory: Member[]
  /** Wall-clock moment the broadcast went on air — video time 0:00. */
  replayStartUtc: string
  /** Live video position in seconds, written by the player without re-rendering. */
  currentTimeRef: RefObject<number>
  onEmojiReaction: (emoji: string) => void
}

function formatVideoOffset(seconds: number) {
  const total = Math.max(0, Math.floor(seconds))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const secs = total % 60
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }
  return `${minutes}:${String(secs).padStart(2, '0')}`
}

/** Number of offsets (sorted ascending) that are <= time. */
function countVisible(offsets: number[], time: number) {
  let low = 0
  let high = offsets.length
  while (low < high) {
    const mid = (low + high) >> 1
    if (offsets[mid] <= time) {
      low = mid + 1
    } else {
      high = mid
    }
  }
  return low
}

function ReplayMessageRow({
  message,
  offsetSeconds,
  sender,
}: {
  message: ChatMessage
  offsetSeconds: number
  sender: Member | undefined
}) {
  if (message.content?.startsWith('[System]')) {
    const cleanContent = message.content.replace('[System]', '').trim()
    return (
      <div className="message-appear flex items-center justify-center py-2.5 px-3.5 my-2 rounded-xl border border-[oklch(0.75_0.12_85)]/20 bg-[oklch(0.75_0.12_85)]/[0.03] text-center shadow-md select-none max-w-[85%] mx-auto relative overflow-hidden">
        <div className="absolute -inset-10 bg-[radial-gradient(circle_at_center,oklch(0.75_0.12_85_/_0.08)_0%,transparent_60%)] pointer-events-none" />
        <span className="text-[11px] text-[oklch(0.75_0.12_85)] font-semibold tracking-wide flex items-center justify-center gap-1.5 relative z-10 leading-normal">
          <span>👑</span>
          <span>{cleanContent}</span>
        </span>
      </div>
    )
  }

  const senderRole = roleLabel(sender)
  const color = nameColor(senderRole, sender?.access_badges, sender?.name_color)
  const visibleBadges = normalizeMemberBadges(sender?.access_badges)

  return (
    <div className="message-appear flex flex-col gap-0.5 px-2 py-1 rounded-lg transition-colors hover:bg-white/3">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-semibold select-none" style={{ color }}>
          {message.display_name}
        </span>
        {senderRole && (
          <span className={`text-[9px] px-1.5 py-0.5 rounded border tracking-wide font-medium ${ROLE_BADGE[senderRole].className}`}>
            <span className="mr-1">{ROLE_BADGE[senderRole].emoji}</span>
            {ROLE_BADGE[senderRole].label}
          </span>
        )}
        {visibleBadges.map((badgeId) => {
          const badge = getMemberBadge(badgeId)
          if (!badge) return null
          return (
            <span
              key={badge.id}
              className={`text-[9px] px-1.5 py-0.5 rounded border ${badge.className}`}
              title={badge.label}
            >
              <span className="mr-1">{badge.emoji}</span>
              {badge.label}
            </span>
          )
        })}
        <span className="text-[10px] text-muted-foreground/50 ml-auto select-none" title="Original moment in the video">
          {formatVideoOffset(offsetSeconds)}
        </span>
      </div>
      {message.content ? (
        <p className="text-sm text-foreground/90 break-words leading-normal whitespace-pre-wrap">
          {message.content}
        </p>
      ) : message.emoji ? (
        <span className="text-2xl leading-tight">{message.emoji}</span>
      ) : null}
    </div>
  )
}

/**
 * Read-only chat that replays the original livestream conversation in sync
 * with video playback — each message appears at the same moment it was sent
 * during the live show, like YouTube's live chat replay. Seeking the video
 * forwards or backwards re-syncs the visible window.
 */
export default function ReplayChatPanel({
  member,
  messages,
  memberDirectory,
  replayStartUtc,
  currentTimeRef,
  onEmojiReaction,
}: ReplayChatPanelProps) {
  // Seconds into the video each message belongs at. Messages sent before the
  // broadcast went on air (waiting-room chat) surface right at 0:00.
  const offsets = useMemo(() => {
    const startMs = new Date(replayStartUtc).getTime()
    return messages.map((message) =>
      Math.max(0, (new Date(message.created_at).getTime() - startMs) / 1000)
    )
  }, [messages, replayStartUtc])

  const [visibleCount, setVisibleCount] = useState(() => countVisible(offsets, 0))

  const memberById = useMemo(() => {
    const map = new Map(memberDirectory.map((directoryMember) => [directoryMember.id, directoryMember]))
    map.set(member.id, member)
    return map
  }, [memberDirectory, member])

  const scrollRef = useRef<HTMLDivElement>(null)
  const shouldAutoScrollRef = useRef(true)
  const onEmojiReactionRef = useRef(onEmojiReaction)
  useEffect(() => {
    onEmojiReactionRef.current = onEmojiReaction
  }, [onEmojiReaction])

  // Follow the player. Reading a ref on an interval keeps the video element
  // from re-rendering this panel (and vice versa) on every half-second tick.
  useEffect(() => {
    const interval = window.setInterval(() => {
      const time = currentTimeRef.current ?? 0
      setVisibleCount((prev) => {
        const next = countVisible(offsets, time)
        if (next === prev) return prev
        if (next > prev && next - prev <= MAX_BURST_REVEAL) {
          for (let index = prev; index < next; index += 1) {
            const message = messages[index]
            if (message && !message.content && message.emoji) {
              onEmojiReactionRef.current(message.emoji)
            }
          }
        }
        return next
      })
    }, TIME_POLL_MS)
    return () => window.clearInterval(interval)
  }, [offsets, messages, currentTimeRef])

  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Virtual manages mutable measurements internally.
  const virtualizer = useVirtualizer({
    count: visibleCount,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 64,
    anchorTo: 'end',
    followOnAppend: true,
  })

  useEffect(() => {
    if (!shouldAutoScrollRef.current || visibleCount === 0) return
    virtualizer.scrollToIndex(visibleCount - 1)
  }, [visibleCount, virtualizer])

  const handleScroll = useCallback(() => {
    const container = scrollRef.current
    if (!container) return
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight
    shouldAutoScrollRef.current = distanceFromBottom < AUTO_SCROLL_THRESHOLD_PX
  }, [])

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col relative">
      {/* Messages */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="min-h-0 flex-1 overscroll-contain overflow-y-auto p-3 relative"
      >
        {visibleCount === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-12 text-center">
            <span className="text-3xl mb-3">🎹</span>
            <p className="text-sm text-muted-foreground">
              Press play — the chat will appear just as it happened live.
            </p>
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
              const message = messages[virtualItem.index]
              if (!message) return null
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
                  <ReplayMessageRow
                    message={message}
                    offsetSeconds={offsets[virtualItem.index]}
                    sender={memberById.get(message.member_id)}
                  />
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Replay notice instead of an input — the show is over, chat is closed. */}
      <div className="glass-heavy border-t border-border/30 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
          <History className="h-3.5 w-3.5 shrink-0 text-[oklch(0.75_0.12_85)]" />
          <span>Chat replay — messages appear in sync with the video</span>
        </p>
      </div>
    </div>
  )
}
