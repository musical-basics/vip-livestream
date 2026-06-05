'use client'

import { useEffect, useState, startTransition } from 'react'
import { getMemberBadge, normalizeMemberBadges } from '@/lib/member-badges'
import { ROLE_BADGE } from '@/lib/roles'
import { CalendarDays, MessageSquare, Loader2, User } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface MemberDetails {
  id: string
  name: string
  display_name: string | null
  name_color: string | null
  access_badges: string[]
  is_moderator: boolean
  is_admin: boolean
  created_at: string
}

interface MemberStats {
  all_time_messages: number
  current_show_messages: number
  streams_attended: number
}

interface MemberProfileModalProps {
  open: boolean
  memberId: string | null
  streamId: string | null
  onClose: () => void
}

export default function MemberProfileModal({
  open,
  memberId,
  streamId,
  onClose,
}: MemberProfileModalProps) {
  const [member, setMember] = useState<MemberDetails | null>(null)
  const [stats, setStats] = useState<MemberStats | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !memberId) return

    let isCancelled = false

    async function loadProfile() {
      setIsLoading(true)
      setError(null)
      setMember(null)
      setStats(null)

      const url = `/api/member/stats?member_id=${memberId}${streamId ? `&stream_id=${streamId}` : ''}`

      try {
        const res = await fetch(url)
        if (!res.ok) throw new Error('Failed to load chatter profile')
        const data = await res.json()
        if (isCancelled) return

        startTransition(() => {
          setMember(data.member)
          setStats(data.stats)
        })
      } catch (err) {
        if (isCancelled) return
        console.error(err)
        setError('Could not retrieve chatter statistics.')
      } finally {
        if (isCancelled) return
        setIsLoading(false)
      }
    }

    const timer = window.setTimeout(() => {
      void loadProfile()
    }, 0)

    return () => {
      isCancelled = true
      window.clearTimeout(timer)
    }
  }, [open, memberId, streamId])

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) onClose()
  }

  const joinDate = member?.created_at
    ? new Date(member.created_at).toLocaleDateString(undefined, {
        month: 'long',
        year: 'numeric',
      })
    : ''

  const visibleBadges = normalizeMemberBadges(member?.access_badges || [])

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="glass max-w-sm border-white/10 p-5 sm:p-6 text-foreground z-[120]">
        <DialogHeader className="gap-3 pr-8">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 border border-white/10 text-gold shrink-0">
            <User className="h-5 w-5" />
          </div>
          <DialogTitle
            className="text-2xl font-light text-gold"
            style={{ fontFamily: "'Cormorant Garamond', serif" }}
          >
            Chatter Profile
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Overview of viewer involvement and credentials.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-10 gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-[oklch(0.75_0.12_85)]" />
            <span className="text-xs text-muted-foreground">Loading details...</span>
          </div>
        ) : error ? (
          <div className="py-6 text-center text-sm text-destructive font-medium">
            {error}
          </div>
        ) : member && stats ? (
          <div className="space-y-4">
            {/* Header info */}
            <div className="flex flex-col items-center text-center p-3 rounded-xl border border-white/5 bg-white/[0.01]">
              <span
                className="text-lg font-bold"
                style={{ color: member.name_color || 'oklch(0.85 0.16 90)' }}
              >
                {member.display_name || member.name}
              </span>
              <span className="text-[10px] text-muted-foreground/60 font-mono mt-0.5">
                ID: {member.id.slice(0, 8)}...
              </span>

              {/* Roles & Badges Grid */}
              <div className="flex flex-wrap items-center justify-center gap-1 mt-3">
                {member.is_admin && (
                  <span className={`text-[8px] px-1.5 py-0.5 rounded border tracking-wide font-medium shrink-0 ${ROLE_BADGE.ADMIN.className}`}>
                    👑 ADMIN
                  </span>
                )}
                {member.is_moderator && (
                  <span className={`text-[8px] px-1.5 py-0.5 rounded border tracking-wide font-medium shrink-0 ${ROLE_BADGE.MOD.className}`}>
                    🛡️ MOD
                  </span>
                )}
                {visibleBadges.map((badgeId) => {
                  const badge = getMemberBadge(badgeId)
                  if (!badge) return null
                  return (
                    <span
                      key={badge.id}
                      className={`text-[8px] px-1.5 py-0.5 rounded border shrink-0 ${badge.className}`}
                      title={badge.label}
                    >
                      <span className="mr-0.5">{badge.emoji}</span>
                      {badge.label}
                    </span>
                  )
                })}
              </div>
            </div>

            {/* Stats Block */}
            <div className="grid grid-cols-3 gap-2">
              <div className="flex flex-col items-center justify-center p-3 rounded-xl border border-white/5 bg-white/[0.02] text-center">
                <span className="text-xl font-bold text-foreground">{stats.current_show_messages}</span>
                <span className="text-[8px] text-muted-foreground/65 uppercase font-medium tracking-wider mt-1 leading-none">
                  This Show
                </span>
              </div>
              <div className="flex flex-col items-center justify-center p-3 rounded-xl border border-white/5 bg-white/[0.02] text-center">
                <span className="text-xl font-bold text-foreground">{stats.all_time_messages}</span>
                <span className="text-[8px] text-muted-foreground/65 uppercase font-medium tracking-wider mt-1 leading-none">
                  Total Chats
                </span>
              </div>
              <div className="flex flex-col items-center justify-center p-3 rounded-xl border border-white/5 bg-white/[0.02] text-center">
                <span className="text-xl font-bold text-foreground">{stats.streams_attended}</span>
                <span className="text-[8px] text-muted-foreground/65 uppercase font-medium tracking-wider mt-1 leading-none">
                  Shows
                </span>
              </div>
            </div>

            {/* Metadata Footer info */}
            <div className="space-y-2.5 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-3.5 w-3.5 text-[oklch(0.75_0.12_85)] shrink-0" />
                <span>Member since {joinDate}</span>
              </div>
              <div className="flex items-center gap-2">
                <MessageSquare className="h-3.5 w-3.5 text-[oklch(0.75_0.12_85)] shrink-0" />
                <span>Level {Math.floor(stats.all_time_messages / 50) + 1} Chatter</span>
              </div>
            </div>
          </div>
        ) : null}

        <Button
          type="button"
          onClick={onClose}
          className="rounded-xl w-full"
          style={{
            background: 'linear-gradient(135deg, oklch(0.75 0.12 85), oklch(0.60 0.10 70))',
            color: 'oklch(0.09 0.015 270)',
          }}
        >
          Close Profile
        </Button>
      </DialogContent>
    </Dialog>
  )
}
