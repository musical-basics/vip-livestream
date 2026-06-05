'use client'

import { useEffect, useState, startTransition } from 'react'
import type { Stream, Member } from '@/lib/database.types'
import { getMemberBadge, normalizeMemberBadges } from '@/lib/member-badges'
import { ROLE_BADGE } from '@/lib/roles'
import { Trophy, Loader2, RefreshCw, MessageSquare, Award, Crown } from 'lucide-react'

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
  memberDirectory: Member[]
  leaderboard: Chatter[]
  isLoading: boolean
  isRefreshing: boolean
  error: string | null
  onRefresh: () => void
}

type ScopeType = 'current' | 'weekly' | 'monthly' | 'all-time'

export default function LeaderboardPanel({
  stream,
  memberDirectory,
  leaderboard,
  isLoading,
  isRefreshing,
  error,
  onRefresh,
}: LeaderboardPanelProps) {
  const [scope, setScope] = useState<ScopeType>('current')
  
  const [localLeaderboards, setLocalLeaderboards] = useState<Record<string, {
    chatters: Chatter[]
    loading: boolean
    refreshing: boolean
    error: string | null
  }>>({
    'weekly': { chatters: [], loading: false, refreshing: false, error: null },
    'monthly': { chatters: [], loading: false, refreshing: false, error: null },
    'all-time': { chatters: [], loading: false, refreshing: false, error: null },
  })

  async function fetchLocalLeaderboard(targetScope: 'weekly' | 'monthly' | 'all-time', refresh = false) {
    setLocalLeaderboards(prev => ({
      ...prev,
      [targetScope]: {
        ...prev[targetScope],
        loading: !refresh,
        refreshing: refresh,
      }
    }))

    try {
      const res = await fetch(`/api/chat/leaderboard?scope=${targetScope}`)
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      
      startTransition(() => {
        setLocalLeaderboards(prev => ({
          ...prev,
          [targetScope]: {
            chatters: data.leaderboard || [],
            loading: false,
            refreshing: false,
            error: null,
          }
        }))
      })
    } catch (err) {
      console.error(err)
      setLocalLeaderboards(prev => ({
        ...prev,
        [targetScope]: {
          ...prev[targetScope],
          loading: false,
          refreshing: false,
          error: `Could not load ${targetScope} leaderboard.`,
        }
      }))
    }
  }

  useEffect(() => {
    if (scope !== 'current') {
      const current = localLeaderboards[scope]
      if (current && current.chatters.length === 0 && !current.loading && !current.error) {
        fetchAllScopesData()
      }
    }
  }, [scope])

  function fetchAllScopesData() {
    if (scope !== 'current') {
      void fetchLocalLeaderboard(scope)
    }
  }

  // Determine active view variables
  const activeChatters = scope === 'current' ? leaderboard : localLeaderboards[scope]?.chatters || []
  const activeLoading = scope === 'current' ? isLoading : localLeaderboards[scope]?.loading || false
  const activeRefreshing = scope === 'current' ? isRefreshing : localLeaderboards[scope]?.refreshing || false
  const activeError = scope === 'current' ? error : localLeaderboards[scope]?.error || null
  const handleRefresh = scope === 'current' ? onRefresh : () => fetchLocalLeaderboard(scope, true)

  const SCOPES = [
    { id: 'current', label: 'Current' },
    { id: 'weekly', label: 'Weekly' },
    { id: 'monthly', label: 'Monthly' },
    { id: 'all-time', label: 'All-Time' },
  ] as const

  if (activeLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-[oklch(0.75_0.12_85)]" />
        <p className="text-xs">Calculating rankings...</p>
      </div>
    )
  }

  if (activeError) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center gap-3">
        <p className="text-sm text-destructive font-medium">{activeError}</p>
        <button
          onClick={handleRefresh}
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
      {/* Header and Refresh */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-amber-400 animate-pulse" />
          <h3 className="text-xs uppercase tracking-widest text-gold font-semibold leading-none">Chat Leaderboard</h3>
        </div>
        <button
          onClick={handleRefresh}
          disabled={activeRefreshing}
          className="p-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-foreground transition-all disabled:opacity-40"
          title="Refresh leaderboard"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${activeRefreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Scope Segmented Control */}
      <div className="grid grid-cols-4 rounded-xl bg-white/[0.03] border border-white/10 p-1 text-[10px] sm:text-xs">
        {SCOPES.map(s => (
          <button
            key={s.id}
            type="button"
            onClick={() => setScope(s.id)}
            className={`py-1.5 px-1 rounded-lg font-medium transition-all text-center truncate ${
              scope === s.id
                ? 'bg-[oklch(0.75_0.12_85)] text-[oklch(0.09_0.015_270)] font-semibold shadow-md'
                : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {activeChatters.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center border border-dashed border-white/10 rounded-xl bg-white/[0.01]">
          <MessageSquare className="w-8 h-8 text-muted-foreground/45 mb-2" />
          <p className="text-sm text-muted-foreground font-medium">No active chatters found</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {activeChatters.map((chatter, index) => {
            const rank = index + 1
            const isTop3 = rank <= 3
            
            // Map senderBadges list from memberDirectory if missing in payload
            const senderDetails = memberDirectory.find(m => m.id === chatter.member_id)
            const badges = chatter.access_badges || senderDetails?.access_badges || []
            const visibleBadges = normalizeMemberBadges(badges)
            const isMod = chatter.is_moderator || senderDetails?.is_moderator || false

            // Premium rank colors & visual highlights
            const rankStyles =
              rank === 1
                ? 'bg-amber-400/20 text-amber-300 border-amber-400/50 shadow-lg shadow-amber-400/5'
                : rank === 2
                ? 'bg-slate-300/20 text-slate-200 border-slate-300/50'
                : rank === 3
                ? 'bg-amber-700/25 text-amber-600 border-amber-700/50'
                : 'bg-white/5 text-muted-foreground border-white/10'

            return (
              <div
                key={chatter.member_id}
                className={`flex items-center justify-between p-3 rounded-xl border transition-all duration-150 group ${
                  rank === 1
                    ? 'border-amber-400/10 bg-amber-400/[0.02] hover:bg-amber-400/[0.04]'
                    : 'border-white/5 bg-white/[0.02] hover:bg-white/[0.05]'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {/* Rank circle with crown/trophy for top chatters */}
                  <div
                    className={`w-6.5 h-6.5 rounded-full border flex items-center justify-center text-[10px] font-bold shrink-0 ${rankStyles}`}
                  >
                    {rank === 1 ? (
                      <Crown className="w-3.5 h-3.5 shrink-0" />
                    ) : isTop3 ? (
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
                      {isMod && (
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
