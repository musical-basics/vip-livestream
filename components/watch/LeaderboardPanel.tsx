'use client'

import { useEffect, useState, startTransition } from 'react'
import type { Stream } from '@/lib/database.types'
import { getMemberBadge, normalizeMemberBadges } from '@/lib/member-badges'
import { ROLE_BADGE } from '@/lib/roles'
import { Trophy, Loader2, RefreshCw, MessageSquare, Award } from 'lucide-react'

interface Chatter {
  member_id: string
  display_name: string
  name: string
  name_color: string | null
  access_badges: string[]
  is_moderator: boolean
  message_count: number
}

interface LeaderboardPanelProps {
  stream: Stream | null
}

export default function LeaderboardPanel({ stream }: LeaderboardPanelProps) {
  const [topChatters, setTopChatters] = useState<Chatter[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function fetchLeaderboard(refresh = false) {
    if (!stream?.id) {
      setIsLoading(false)
      return
    }

    if (refresh) {
      setIsRefreshing(true)
    } else {
      setIsLoading(true)
    }

    try {
      const res = await fetch(`/api/chat/leaderboard?stream_id=${stream.id}`)
      if (!res.ok) throw new Error('Failed to fetch leaderboard')
      const data = await res.json()
      startTransition(() => {
        setTopChatters(data.leaderboard || [])
        setError(null)
      })
    } catch (err) {
      console.error(err)
      setError('Could not load chatter leaderboard.')
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    fetchLeaderboard()
  }, [stream?.id])

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-[oklch(0.75_0.12_85)]" />
        <p className="text-xs">Calculating top chatters...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center gap-3">
        <p className="text-sm text-destructive font-medium">{error}</p>
        <button
          onClick={() => fetchLeaderboard(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-xs font-semibold text-foreground transition-all"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Try Again
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-amber-400" />
          <h3 className="text-xs uppercase tracking-widest text-gold font-semibold leading-none">Top Chatters</h3>
        </div>
        <button
          onClick={() => fetchLeaderboard(true)}
          disabled={isRefreshing}
          className="p-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-foreground transition-all disabled:opacity-40"
          title="Refresh leaderboard"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {topChatters.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center border border-dashed border-white/10 rounded-xl bg-white/[0.01]">
          <MessageSquare className="w-8 h-8 text-muted-foreground/45 mb-2" />
          <p className="text-sm text-muted-foreground font-medium">No messages in this stream yet</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {topChatters.map((chatter, index) => {
            const rank = index + 1
            const isTop3 = rank <= 3
            const visibleBadges = normalizeMemberBadges(chatter.access_badges)

            // Rank visual indicator style
            const rankStyles =
              rank === 1
                ? 'bg-amber-400/20 text-amber-300 border-amber-400/40'
                : rank === 2
                ? 'bg-slate-300/20 text-slate-200 border-slate-300/40'
                : rank === 3
                ? 'bg-amber-700/20 text-amber-600 border-amber-700/40'
                : 'bg-white/5 text-muted-foreground border-white/10'

            return (
              <div
                key={chatter.member_id}
                className="flex items-center justify-between p-3 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] transition-all duration-150 group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {/* Rank circle */}
                  <div
                    className={`w-6 h-6 rounded-full border flex items-center justify-center text-[10px] font-bold shrink-0 ${rankStyles}`}
                  >
                    {isTop3 ? (
                      <Award className="w-3.5 h-3.5 shrink-0" />
                    ) : (
                      rank
                    )}
                  </div>

                  {/* Display Name and Badges */}
                  <div className="flex flex-col min-w-0 gap-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span
                        className="text-xs font-semibold truncate max-w-[140px]"
                        style={{ color: chatter.name_color || 'oklch(0.85 0.16 90)' }}
                      >
                        {chatter.display_name}
                      </span>
                      {chatter.is_moderator && (
                        <span className={`text-[8px] px-1 py-0.5 rounded border scale-90 tracking-wide font-medium shrink-0 ${ROLE_BADGE.MOD.className}`}>
                          🛡️ MOD
                        </span>
                      )}
                      {visibleBadges.map((badgeId) => {
                        const badge = getMemberBadge(badgeId)
                        if (!badge) return null
                        return (
                          <span
                            key={badge.id}
                            className={`text-[8px] px-1 py-0.5 rounded border scale-90 shrink-0 ${badge.className}`}
                            title={badge.label}
                          >
                            <span>{badge.emoji}</span>
                          </span>
                        )
                      })}
                    </div>
                  </div>
                </div>

                {/* Message count badge */}
                <div className="flex items-center gap-1.5 shrink-0 bg-white/5 border border-white/8 rounded-lg px-2.5 py-1 text-[10px] text-muted-foreground group-hover:border-white/15 transition-all">
                  <span className="font-semibold text-foreground">{chatter.message_count}</span>
                  <span className="text-[9px] text-muted-foreground/60 uppercase tracking-wider">chats</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
