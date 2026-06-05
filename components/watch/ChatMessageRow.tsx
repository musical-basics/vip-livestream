'use client'

import { memo, useState } from 'react'
import type { Member, ChatMessage } from '@/lib/database.types'
import { getMemberBadge, normalizeMemberBadges } from '@/lib/member-badges'
import { canModerateChat, nameColor, ROLE_BADGE } from '@/lib/roles'
import { formatDistanceToNow } from 'date-fns'
import { MoreHorizontal, Trash2, Clock, Smile, Pin } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface ChatMessageRowProps {
  message: ChatMessage
  currentMember: Member
  senderBadges?: string[]
  senderRole: 'ADMIN' | 'MOD' | null
  isMuted: boolean
  isPinned: boolean
  streamId: string | undefined
  onDeleted: (messageId: string) => void
  onReacted: (messageId: string, reactions: Record<string, string[]>) => void
  onPinToggle: (message: ChatMessage) => void
  isMenuOpen: boolean
  activeMenuPosition: { x: number; y: number } | null
  setActiveMenu: (messageId: string | null, position: { x: number; y: number } | null) => void
}

const TIMEOUT_OPTIONS = [
  { label: '5 minutes', minutes: 5 },
  { label: '30 minutes', minutes: 30 },
  { label: 'Permanent', minutes: null },
]

function ChatMessageRow({
  message,
  currentMember,
  senderBadges,
  senderRole,
  isMuted,
  isPinned,
  streamId,
  onDeleted,
  onReacted,
  onPinToggle,
  isMenuOpen,
  activeMenuPosition,
  setActiveMenu,
}: ChatMessageRowProps) {
  const [isActing, setIsActing] = useState(false)

  const isMod = canModerateChat(currentMember)
  const isOwn = message.member_id === currentMember.id
  const color = nameColor(senderRole, senderBadges)
  const visibleBadges = normalizeMemberBadges(senderBadges)

  function openContextMenu(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setActiveMenu(message.id, {
      x: Math.min(e.clientX, window.innerWidth - 210),
      y: Math.min(e.clientY, window.innerHeight - (isMod ? 320 : 100)),
    })
  }

  async function handleToggleReaction(emoji: string) {
    if (!streamId) return
    setIsActing(true)
    setActiveMenu(null, null)
    try {
      const res = await fetch('/api/chat/react', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message_id: message.id,
          emoji,
          stream_id: streamId,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        onReacted(message.id, data.reactions)
      }
    } catch (err) {
      console.error('Failed to react:', err)
    } finally {
      setIsActing(false)
    }
  }

  async function handleTimeout(minutes: number | null) {
    if (!streamId) return
    setIsActing(true)
    setActiveMenu(null, null)
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
    setActiveMenu(null, null)
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
      </>
    )
  }

  function renderReactions() {
    const rx = message.reactions
    if (!rx || Object.keys(rx).length === 0) return null

    return (
      <div className="flex flex-wrap gap-1 mt-1.5 pl-0">
        {Object.entries(rx).map(([emoji, memberIds]) => {
          if (!memberIds || memberIds.length === 0) return null
          const hasReacted = memberIds.includes(currentMember.id)
          return (
            <button
              key={emoji}
              onClick={() => handleToggleReaction(emoji)}
              disabled={isActing}
              className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] transition-all border ${
                hasReacted
                  ? 'bg-[oklch(0.75_0.12_85)/15] border-[oklch(0.75_0.12_85)/40] text-[oklch(0.75_0.12_85)] font-semibold'
                  : 'bg-white/5 border-white/10 text-muted-foreground hover:bg-white/10 hover:text-foreground'
              }`}
              title={`${memberIds.length} reaction${memberIds.length > 1 ? 's' : ''}`}
            >
              <span>{emoji}</span>
              <span>{memberIds.length}</span>
            </button>
          )
        })}
      </div>
    )
  }

  if (isMuted) {
    // Moderators see muted messages greyed out; others see nothing
    if (!isMod) return null
    return (
      <div
        onContextMenu={openContextMenu}
        className="message-appear flex gap-2 px-2 py-1 rounded-lg opacity-30"
      >
        <span className="text-xs" style={{ color }}>
          {message.display_name}
        </span>
        <span className="text-xs text-muted-foreground line-through">
          {message.content || message.emoji}
        </span>
        <span className="text-[10px] text-muted-foreground ml-auto">[muted]</span>
        {isMenuOpen && activeMenuPosition && (
          <ModMenu
            position={activeMenuPosition}
            isOwn={isOwn}
            isActing={isActing}
            currentMember={currentMember}
            reactions={message.reactions}
            isPinned={isPinned}
            onReact={handleToggleReaction}
            onDelete={handleMuteMessage}
            onTimeout={handleTimeout}
            onPinToggle={() => {
              setActiveMenu(null, null)
              onPinToggle(message)
            }}
          />
        )}
      </div>
    )
  }

  // Emoji-only message
  if (!message.content && message.emoji) {
    return (
      <div
        onContextMenu={openContextMenu}
        className="message-appear group relative flex flex-col gap-0.5 px-2 py-1 rounded-lg hover:bg-white/3 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold" style={{ color }}>
            {message.display_name}
          </span>
          {renderSenderBadges()}
          <button
            onClick={(e) => {
              e.stopPropagation()
              if (isMenuOpen) {
                setActiveMenu(null, null)
              } else {
                setActiveMenu(message.id, {
                  x: Math.min(e.clientX, window.innerWidth - 210),
                  y: Math.min(e.clientY, window.innerHeight - (isMod ? 320 : 100)),
                })
              }
            }}
            className="ml-auto opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-white/10 transition-all"
            title={isMod ? "Moderator actions & reactions" : "React to message"}
          >
            {isMod ? (
              <MoreHorizontal className="w-3.5 h-3.5 text-muted-foreground" />
            ) : (
              <Smile className="w-3.5 h-3.5 text-muted-foreground" />
            )}
          </button>
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

        <div className="text-lg py-0.5">{message.emoji}</div>
        {renderReactions()}

        {isMenuOpen && activeMenuPosition && (
          <ModMenu
            position={activeMenuPosition}
            isOwn={isOwn}
            isActing={isActing}
            currentMember={currentMember}
            reactions={message.reactions}
            isPinned={isPinned}
            onReact={handleToggleReaction}
            onDelete={handleMuteMessage}
            onTimeout={handleTimeout}
            onPinToggle={() => {
              setActiveMenu(null, null)
              onPinToggle(message)
            }}
          />
        )}
      </div>
    )
  }

  return (
    <div
      onContextMenu={openContextMenu}
      className="message-appear group relative flex flex-col gap-0.5 px-2 py-1 rounded-lg hover:bg-white/3 transition-colors"
    >
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold" style={{ color }}>
          {message.display_name}
        </span>
        {renderSenderBadges()}
        <button
          onClick={(e) => {
            e.stopPropagation()
            if (isMenuOpen) {
              setActiveMenu(null, null)
            } else {
              setActiveMenu(message.id, {
                x: Math.min(e.clientX, window.innerWidth - 210),
                y: Math.min(e.clientY, window.innerHeight - (isMod ? 320 : 100)),
              })
            }
          }}
          className="ml-auto opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-white/10 transition-all"
          title={isMod ? "Moderator actions & reactions" : "React to message"}
        >
          {isMod ? (
            <MoreHorizontal className="w-3.5 h-3.5 text-muted-foreground" />
          ) : (
            <Smile className="w-3.5 h-3.5 text-muted-foreground" />
          )}
        </button>
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

      {renderReactions()}

      {isMenuOpen && activeMenuPosition && (
        <ModMenu
          position={activeMenuPosition}
          isOwn={isOwn}
          isActing={isActing}
          currentMember={currentMember}
          reactions={message.reactions}
          isPinned={isPinned}
          onReact={handleToggleReaction}
          onDelete={handleMuteMessage}
          onTimeout={handleTimeout}
          onPinToggle={() => {
            setActiveMenu(null, null)
            onPinToggle(message)
          }}
        />
      )}
    </div>
  )
}

function ModMenu({
  position,
  isOwn,
  isActing,
  currentMember,
  reactions,
  isPinned,
  onReact,
  onDelete,
  onTimeout,
  onPinToggle,
}: {
  position: { x: number; y: number }
  isOwn: boolean
  isActing: boolean
  currentMember: Member
  reactions: Record<string, string[]> | null
  isPinned: boolean
  onReact: (emoji: string) => void
  onDelete: () => void
  onTimeout: (minutes: number | null) => void
  onPinToggle: () => void
}) {
  const REACTION_EMOJIS = ['❤️', '👏', '🔥', '🎹', '👍', '😂']
  const isMod = canModerateChat(currentMember)

  return (
    <div
      className="mod-menu-container fixed z-50 bg-popover rounded-xl shadow-2xl p-1 min-w-[200px] border border-border flex flex-col gap-1"
      style={{ left: position.x, top: position.y }}
    >
      <p className="text-[10px] text-muted-foreground px-2 py-1 tracking-widest uppercase">
        Reactions
      </p>
      {/* Quick reaction emojis grid */}
      <div className="grid grid-cols-6 gap-1 px-1 py-0.5">
        {REACTION_EMOJIS.map((emoji) => {
          const hasReacted = reactions?.[emoji]?.includes(currentMember.id)
          return (
            <button
              key={emoji}
              onClick={() => onReact(emoji)}
              disabled={isActing}
              className={`text-lg p-1 rounded-lg transition-all hover:scale-125 ${
                hasReacted ? 'bg-[oklch(0.75_0.12_85)/20] scale-110' : 'hover:bg-white/5'
              }`}
            >
              {emoji}
            </button>
          )
        })}
      </div>

      {isMod && (
        <>
          <div className="my-1 border-t border-white/10" />
          <p className="text-[10px] text-muted-foreground px-2 py-1 tracking-widest uppercase">
            Mod Actions
          </p>
          <button
            onClick={onPinToggle}
            disabled={isActing}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-white/5 rounded-lg transition-colors text-left text-foreground/80"
          >
            <Pin className="w-3.5 h-3.5 text-muted-foreground" />
            {isPinned ? 'Unpin message' : 'Pin message'}
          </button>
          <button
            onClick={onDelete}
            disabled={isActing}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-destructive/15 rounded-lg transition-colors text-left text-destructive/90"
          >
            <Trash2 className="w-3.5 h-3.5" />
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
                  <Clock className="w-3.5 h-3.5" />
                  Timeout {opt.label}
                </button>
              ))}
            </>
          )}
        </>
      )}
    </div>
  )
}

export default memo(ChatMessageRow)
