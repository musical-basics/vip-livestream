'use client'

import { useRouter } from 'next/navigation'
import type { Member, Stream } from '@/lib/database.types'
import { getMemberBadge, normalizeMemberBadges } from '@/lib/member-badges'
import { isAdmin, roleBadge } from '@/lib/roles'
import { LogOut, Radio, Settings, Film } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface HeaderProps {
  member: Member
  stream: Stream | null
}

export default function Header({ member, stream }: HeaderProps) {
  const router = useRouter()
  const memberBadges = normalizeMemberBadges(member.access_badges)
  const memberRoleBadge = roleBadge(member)

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/')
    router.refresh()
  }

  return (
    <header className="glass-heavy sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-border/50 px-3 py-3 sm:px-4 lg:px-6">
      {/* Brand */}
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[oklch(0.78_0.13_85)] to-[oklch(0.55_0.10_70)] text-sm">
          🎹
        </div>
        <div className="min-w-0">
          <h1
            className="truncate text-base font-light leading-none text-gold sm:text-lg"
            style={{ fontFamily: "'Cormorant Garamond', serif" }}
          >
            MusicalBasics
          </h1>
          <p className="text-[10px] text-muted-foreground tracking-widest uppercase leading-none mt-0.5">
            VIP Livestream
          </p>
        </div>
      </div>

      {/* Center: live badge */}
      {stream?.is_live && (
        <div className="hidden items-center gap-2 rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1 sm:flex">
          <Radio className="w-3 h-3 text-red-400" />
          <span className="text-xs font-semibold text-red-400 tracking-widest uppercase">
            Live
          </span>
        </div>
      )}

      {/* Right: member info + logout */}
      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        <div className="hidden sm:flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[oklch(0.75_0.12_85)] to-[oklch(0.55_0.10_70)] flex items-center justify-center text-[10px] font-bold text-[oklch(0.09_0.015_270)]">
            {(member.display_name || member.name)[0]?.toUpperCase()}
          </div>
          <span className="text-sm text-muted-foreground">
            {member.display_name || member.name}
          </span>
          {memberRoleBadge && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded border tracking-wide font-medium ${memberRoleBadge.className}`}>
              <span className="mr-1">{memberRoleBadge.emoji}</span>
              {memberRoleBadge.label}
            </span>
          )}
          {memberBadges.map((badgeId) => {
            const badge = getMemberBadge(badgeId)
            if (!badge) return null
            return (
              <span
                key={badge.id}
                className={`text-[10px] px-1.5 py-0.5 rounded border ${badge.className}`}
                title={badge.label}
              >
                <span className="mr-1">{badge.emoji}</span>
                {badge.label}
              </span>
            )
          })}
        </div>
        <a
          href="/recordings"
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-2.5 py-1.5 rounded-lg hover:bg-white/8"
          title="Video recordings"
        >
          <Film className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Recordings</span>
        </a>
        {isAdmin(member) && (
          <a
            href="/admin"
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-2.5 py-1.5 rounded-lg hover:bg-white/8"
            title="Admin panel"
          >
            <Settings className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Admin</span>
          </a>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleLogout}
          className="flex items-center gap-1 text-muted-foreground hover:text-foreground rounded-lg h-8 px-2.5"
          title="Log out"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span className="hidden sm:inline text-xs">Log out</span>
        </Button>
      </div>
    </header>
  )
}
