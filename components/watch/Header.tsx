'use client'

import { useRouter } from 'next/navigation'
import type { Member, Stream } from '@/lib/database.types'
import { LogOut, Radio, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface HeaderProps {
  member: Member
  stream: Stream | null
}

export default function Header({ member, stream }: HeaderProps) {
  const router = useRouter()

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/')
    router.refresh()
  }

  return (
    <header className="glass-heavy border-b border-border/50 px-4 lg:px-6 py-3 flex items-center justify-between z-30 relative">
      {/* Brand */}
      <div className="flex items-center gap-3">
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[oklch(0.78_0.13_85)] to-[oklch(0.55_0.10_70)] flex items-center justify-center text-sm">
          🎹
        </div>
        <div>
          <h1
            className="text-lg font-light leading-none text-gold"
            style={{ fontFamily: "'Cormorant Garamond', serif" }}
          >
            Musical Basics
          </h1>
          <p className="text-[10px] text-muted-foreground tracking-widest uppercase leading-none mt-0.5">
            VIP Livestream
          </p>
        </div>
      </div>

      {/* Center: live badge */}
      {stream?.is_live && (
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20">
          <Radio className="w-3 h-3 text-red-400" />
          <span className="text-xs font-semibold text-red-400 tracking-widest uppercase">
            Live
          </span>
        </div>
      )}

      {/* Right: member info + logout */}
      <div className="flex items-center gap-3">
        <div className="hidden sm:flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[oklch(0.75_0.12_85)] to-[oklch(0.55_0.10_70)] flex items-center justify-center text-[10px] font-bold text-[oklch(0.09_0.015_270)]">
            {(member.display_name || member.name)[0]?.toUpperCase()}
          </div>
          <span className="text-sm text-muted-foreground">
            {member.display_name || member.name}
          </span>
          {member.is_moderator && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[oklch(0.75_0.12_85)/15] text-[oklch(0.75_0.12_85)] border border-[oklch(0.75_0.12_85)/30] tracking-wide">
              MOD
            </span>
          )}
        </div>
        {member.is_moderator && (
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
          className="text-muted-foreground hover:text-foreground rounded-lg h-8 px-2.5"
          title="Leave"
        >
          <LogOut className="w-3.5 h-3.5" />
        </Button>
      </div>
    </header>
  )
}
