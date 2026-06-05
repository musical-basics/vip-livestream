'use client'

import { useState, useEffect } from 'react'
import type { Member, ChatMessage } from '@/lib/database.types'
import { getMemberBadge, normalizeMemberBadges } from '@/lib/member-badges'
import { formatDistanceToNow } from 'date-fns'
import { MoreHorizontal, Trash2, Clock } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface ChatMessageRowProps {
  message: ChatMessage
  currentMember: Member
  senderBadges?: string[]
  senderIsModerator: boolean
  isMuted: boolean
  streamId: string | undefined
  onDeleted: (messageId: string) => void
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
  senderBadges,
  senderIsModerator,
  isMuted,
  streamId,
  onDeleted,
}: ChatMessageRowProps) {
  const [modMenuPosition, setModMenuPosition] = useState<{ x: number; y: number } | null>(null)
  const [isActing, setIsActing] = useState(false)

  useEffect(() => {
    if (!modMenuPosition) return

    function handleGlobalClose(e: Event) {
      if ((e.target as Element).closest('.mod-menu-container')) {
        return
      }
      setModMenuPosition(null)
    }

    const timer = setTimeout(() => {
      window.addEventListener('pointerdown', handleGlobalClose)
      window.addEventListener('contextmenu', handleGlobalClose)
    }, 0)

    return () => {
      clearTimeout(timer)
      window.removeEventListener('pointerdown', handleGlobalClose)
      window.removeEventListener('contextmenu', handleGlobalClose)
    }
  }, [modMenuPosition])

  const isMod = currentMember.is_moderator
  const isOwn = message.member_id === currentMember.id
  const color = getMemberColor(message.member_id)
  const visibleBadges = normalizeMemberBadges(senderBadges)

  function openModMenu(e: React.MouseEvent) {
    if (!isMod) return
    e.preventDefault()
    setModMenuPosition({
      x: Math.min(e.clientX, window.innerWidth - 190),
      y: Math.min(e.clientY, window.innerHeight - 260),
    })
  }

  async function handleTimeout(minutes: number | null) {
    if (!streamId) return
    setIsActing(true)
    setModMenuPosition(null)
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
    setModMenuPosition(null)
    try {
      const res = await fetch('/api/mod/delete-message', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message_id: message.id,
          stream_id: streamId,
        }),
      })
      if (res.ok) onDeleted(message.id)
    } finally {
      setIsActing(false)
    }
  }

  function renderSenderBadges() {
    return (
      <>
        {senderIsModerator && (
          <span className="text-[9px] px-1.5 py-0.5 rounded border border-[oklch(0.75_0.12_85)/35] text-[oklch(0.78_0.13_85)] bg-[oklch(0.75_0.12_85)/10] tracking-wide">
            MOD
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
      </>
    )
  }

  if (isMuted) {
    // Moderators see muted messages greyed out; others see nothing
    if (!isMod) return null
    return (
      <div
        onContextMenu={openModMenu}
        className="message-appear flex gap-2 px-2 py-1 rounded-lg opacity-30"
      >
        <span className="text-xs" style={{ color }}>
          {message.display_name}
        </span>
        <span className="text-xs text-muted-foreground line-through">
          {message.content || message.emoji}
        </span>
        <span className="text-[10px] text-muted-foreground ml-auto">[muted]</span>
        {modMenuPosition && isMod && (
          <ModMenu
            position={modMenuPosition}
            isOwn={isOwn}
            isActing={isActing}
            onDelete={handleMuteMessage}
            onTimeout={handleTimeout}
          />
        )}
      </div>
    )
  }

  // Emoji-only message
  if (!message.content && message.emoji) {
    return (
      <div
        onContextMenu={openModMenu}
        className="message-appear flex items-center gap-1.5 px-2 py-0.5"
      >
        <span className="text-xs font-medium" style={{ color }}>
          {message.display_name}
        </span>
        {renderSenderBadges()}
        <span className="text-lg">{message.emoji}</span>
        {modMenuPosition && isMod && (
          <ModMenu
            position={modMenuPosition}
            isOwn={isOwn}
            isActing={isActing}
            onDelete={handleMuteMessage}
            onTimeout={handleTimeout}
          />
        )}
      </div>
    )
  }

  return (
    <div
      onContextMenu={openModMenu}
      className="message-appear group relative flex flex-col gap-0.5 px-2 py-1 rounded-lg hover:bg-white/3 transition-colors"
    >
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold" style={{ color }}>
          {message.display_name}
        </span>
        {renderSenderBadges()}
        {isMod && (
          <button
            onClick={(e) =>
              setModMenuPosition((position) =>
                position
                  ? null
                  : {
                      x: Math.min(e.clientX, window.innerWidth - 190),
                      y: Math.min(e.clientY, window.innerHeight - 260),
                    }
              )
            }
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
      {modMenuPosition && isMod && (
        <ModMenu
          position={modMenuPosition}
          isOwn={isOwn}
          isActing={isActing}
          onDelete={handleMuteMessage}
          onTimeout={handleTimeout}
        />
      )}
    </div>
  )
}

function ModMenu({
  position,
  isOwn,
  isActing,
  onDelete,
  onTimeout,
}: {
  position: { x: number; y: number }
  isOwn: boolean
  isActing: boolean
  onDelete: () => void
  onTimeout: (minutes: number | null) => void
}) {
  return (
    <div
      className="mod-menu-container fixed z-50 bg-popover rounded-xl shadow-2xl p-1 min-w-[178px] border border-border"
      style={{ left: position.x, top: position.y }}
    >
      <p className="text-[10px] text-muted-foreground px-2 py-1 tracking-widest uppercase">
        Mod Actions
      </p>
      <button
        onClick={onDelete}
        disabled={isActing}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-destructive/15 rounded-lg transition-colors text-left text-destructive/90"
      >
        <Trash2 className="w-3 h-3" />
        Delete chat
      </button>
      {!isOwn && (
        <>
          <div className="my-1 border-t border-white/10" />
          {TIMEOUT_OPTIONS.map((opt) => (
            <button
              key={opt.label}
              onClick={() => onTimeout(opt.minutes)}
              disabled={isActing}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-destructive/20 rounded-lg transition-colors text-left text-destructive/80"
            >
              <Clock className="w-3 h-3" />
              Timeout {opt.label}
            </button>
          ))}
        </>
      )}
    </div>
  )
}
