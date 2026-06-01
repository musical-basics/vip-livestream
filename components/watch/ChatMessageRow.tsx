'use client'

import { useState } from 'react'
import type { Member, ChatMessage } from '@/lib/database.types'
import { formatDistanceToNow } from 'date-fns'
import { MoreHorizontal, VolumeX, Clock } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface ChatMessageRowProps {
  message: ChatMessage
  currentMember: Member
  isMuted: boolean
  streamId: string | undefined
}

const TIMEOUT_OPTIONS = [
  { label: '5 minutes', minutes: 5 },
  { label: '30 minutes', minutes: 30 },
  { label: 'Permanent', minutes: null },
]

// Assign consistent colors to users
function getMemberColor(memberId: string): string {
  const colors = [
    'oklch(0.75 0.12 85)',   // gold
    'oklch(0.70 0.15 220)',  // blue
    'oklch(0.72 0.14 160)',  // teal
    'oklch(0.68 0.16 320)',  // pink
    'oklch(0.73 0.13 270)',  // purple
    'oklch(0.71 0.14 40)',   // orange
  ]
  const hash = memberId.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return colors[hash % colors.length]
}

export default function ChatMessageRow({
  message,
  currentMember,
  isMuted,
  streamId,
}: ChatMessageRowProps) {
  const [showMod, setShowMod] = useState(false)
  const [isActing, setIsActing] = useState(false)

  const isMod = currentMember.is_moderator
  const isOwn = message.member_id === currentMember.id
  const color = getMemberColor(message.member_id)

  async function handleTimeout(minutes: number | null) {
    if (!streamId) return
    setIsActing(true)
    setShowMod(false)
    try {
      await fetch('/api/mod/timeout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_member_id: message.member_id,
          stream_id: streamId,
          minutes,
        }),
      })
    } finally {
      setIsActing(false)
    }
  }

  async function handleMuteMessage() {
    if (!streamId) return
    setIsActing(true)
    setShowMod(false)
    try {
      await fetch('/api/mod/mute-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message_id: message.id,
          stream_id: streamId,
        }),
      })
    } finally {
      setIsActing(false)
    }
  }

  if (isMuted) {
    // Moderators see muted messages greyed out; others see nothing
    if (!isMod) return null
    return (
      <div className="message-appear flex gap-2 px-2 py-1 rounded-lg opacity-30">
        <span className="text-xs" style={{ color }}>
          {message.display_name}
        </span>
        <span className="text-xs text-muted-foreground line-through">
          {message.content || message.emoji}
        </span>
        <span className="text-[10px] text-muted-foreground ml-auto">[muted]</span>
      </div>
    )
  }

  // Emoji-only message
  if (!message.content && message.emoji) {
    return (
      <div className="message-appear flex items-center gap-1.5 px-2 py-0.5">
        <span className="text-xs font-medium" style={{ color }}>
          {message.display_name}
        </span>
        <span className="text-lg">{message.emoji}</span>
      </div>
    )
  }

  return (
    <div
      className="message-appear group relative flex flex-col gap-0.5 px-2 py-1 rounded-lg hover:bg-white/3 transition-colors"
    >
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold" style={{ color }}>
          {message.display_name}
        </span>
        {isMod && isOwn === false && (
          <button
            onClick={() => setShowMod((v) => !v)}
            className="ml-auto opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-white/10 transition-all"
          >
            <MoreHorizontal className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="text-[10px] text-muted-foreground/50 ml-auto cursor-default">
              {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
            </span>
          </TooltipTrigger>
          <TooltipContent>
            {new Date(message.created_at).toLocaleTimeString()}
          </TooltipContent>
        </Tooltip>
      </div>

      <p className="text-sm text-foreground/90 break-words leading-relaxed pl-0">
        {message.content}
      </p>

      {/* Moderator dropdown */}
      {showMod && isMod && (
        <div className="absolute right-0 top-full mt-1 z-50 glass rounded-xl shadow-xl p-1 min-w-[160px] border border-white/10">
          <p className="text-[10px] text-muted-foreground px-2 py-1 tracking-widest uppercase">
            Mod Actions
          </p>
          <button
            onClick={handleMuteMessage}
            disabled={isActing}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-white/10 rounded-lg transition-colors text-left"
          >
            <VolumeX className="w-3 h-3" />
            Delete this message
          </button>
          <div className="my-1 border-t border-white/10" />
          {TIMEOUT_OPTIONS.map((opt) => (
            <button
              key={opt.label}
              onClick={() => handleTimeout(opt.minutes)}
              disabled={isActing}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-destructive/20 rounded-lg transition-colors text-left text-destructive/80"
            >
              <Clock className="w-3 h-3" />
              Timeout {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
