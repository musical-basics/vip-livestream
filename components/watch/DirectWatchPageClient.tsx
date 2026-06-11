'use client'

import React from 'react'
import type { Member, Stream } from '@/lib/database.types'
import { Button } from '@/components/ui/button'
import {
  Tv,
  ExternalLink,
  MessageSquare,
  Sparkles,
  ArrowRight,
  Settings,
} from 'lucide-react'
import Link from 'next/link'

interface DirectWatchPageClientProps {
  member: Member
  stream: Stream | null
}

export default function DirectWatchPageClient({ member, stream }: DirectWatchPageClientProps) {
  if (!stream) {
    return (
      <div className="relative flex min-h-[100dvh] items-center justify-center px-4 py-12">
        <div className="glass max-w-md w-full rounded-2xl p-6 text-center space-y-4">
          <Tv className="w-12 h-12 mx-auto text-muted-foreground opacity-40 animate-pulse" />
          <h2 className="text-2xl font-light text-gold" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
            No streams available
          </h2>
          <p className="text-sm text-muted-foreground">
            There are no active streams scheduled at the moment. Please check back later or contact support.
          </p>
          <div className="pt-2">
            <Link href="/">
              <Button variant="outline" className="w-full rounded-xl border-white/10">
                Go to Homepage
              </Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const mainUrl = `https://youtube.com/watch?v=${stream.youtube_video_id}`
  const backup1Url = stream.backup_youtube_video_id_1 ? `https://youtube.com/watch?v=${stream.backup_youtube_video_id_1}` : null
  const backup2Url = stream.backup_youtube_video_id_2 ? `https://youtube.com/watch?v=${stream.backup_youtube_video_id_2}` : null

  return (
    <div className="min-h-[100dvh] flex flex-col">
      {/* Header */}
      <header className="glass-heavy flex items-center justify-between border-b border-border/50 px-4 py-4 sm:px-6">
        <div className="flex items-center gap-2">
          <span className="text-sm">🎹</span>
          <span
            className="text-lg font-light text-gold"
            style={{ fontFamily: "'Cormorant Garamond', serif" }}
          >
            MusicalBasics VIP
          </span>
        </div>
        <div className="flex items-center gap-3">
          {member.is_admin && (
            <Link href="/admin">
              <Button size="sm" variant="ghost" className="text-xs text-muted-foreground hover:text-foreground hover:bg-white/5 rounded-lg flex items-center gap-1">
                <Settings className="w-3.5 h-3.5" />
                Admin Panel
              </Button>
            </Link>
          )}
          <Link href="/watch">
            <Button size="sm" variant="outline" className="text-xs border-white/10 hover:bg-white/5 rounded-xl flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5" />
              Interactive Chat
            </Button>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 md:p-8">
        <div className="relative w-full max-w-xl space-y-6">
          
          {/* Welcome Tag */}
          <div className="flex items-center justify-between px-1">
            <span className="text-xs text-muted-foreground font-medium">
              Welcome back, <span className="text-foreground font-semibold">{member.display_name || member.name}</span>
            </span>
            {stream.is_live && (
              <span className="flex items-center gap-1.5 rounded-full border border-red-500/20 bg-red-500/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-red-400">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                </span>
                Live Now
              </span>
            )}
          </div>

          {/* Stream Card */}
          <div className="glass rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6 border border-white/10 relative overflow-hidden">
            {/* Ambient background glow if live */}
            {stream.is_live && (
              <div className="absolute -inset-4 bg-gradient-to-br from-red-500/5 to-gold/5 blur-xl pointer-events-none opacity-40" />
            )}

            <div className="space-y-2 relative">
              <span className="text-[10px] font-semibold tracking-widest uppercase text-gold">
                VIP Streaming Portal
              </span>
              <h1 className="text-3xl font-light tracking-wide text-foreground leading-tight" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
                {stream.title}
              </h1>
              {stream.description && (
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {stream.description}
                </p>
              )}
            </div>

            <div className="space-y-4 relative">
              {/* Main Feed Button */}
              <div className="space-y-1.5">
                <span className="block text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/80 px-1">
                  Main Feed
                </span>
                <a
                  href={mainUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block group"
                >
                  <Button
                    className="w-full h-16 rounded-xl font-semibold tracking-wide text-base transition-all duration-300 flex items-center justify-between px-6 shadow-[0_0_20px_oklch(0.75_0.12_85_/_0.15)] group-hover:shadow-[0_0_25px_oklch(0.75_0.12_85_/_0.3)]"
                    style={{
                      background: 'linear-gradient(135deg, oklch(0.78 0.13 85), oklch(0.62 0.10 70))',
                      color: 'oklch(0.09 0.015 270)',
                    }}
                  >
                    <span className="flex items-center gap-3">
                      <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current shrink-0" xmlns="http://www.w3.org/2000/svg">
                        <path d="M23.498 6.163a3.003 3.003 0 0 0-2.11-2.108C19.524 3.545 12 3.545 12 3.545s-7.525 0-9.387.51a3.003 3.003 0 0 0-2.11 2.108C0 8.025 0 12 0 12s0 3.975.503 5.837a3.003 3.003 0 0 0 2.11 2.108c1.862.51 9.387.51 9.387.51s7.525 0 9.387-.51a3.003 3.003 0 0 0 2.11-2.108C24 15.975 24 12 24 12s0-3.975-.502-5.837zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                      </svg>
                      Open Main Stream in YouTube
                    </span>
                    <ExternalLink className="w-5 h-5 opacity-70 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                  </Button>
                </a>
              </div>

              {/* Backup Feeds */}
              {(backup1Url || backup2Url) && (
                <div className="pt-2 border-t border-white/5 space-y-4">
                  <span className="block text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/80 px-1">
                    Backup Feeds
                  </span>
                  
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {backup1Url && (
                      <a href={backup1Url} target="_blank" rel="noopener noreferrer" className="block group">
                        <Button
                          variant="outline"
                          className="w-full h-12 rounded-xl border-white/10 bg-white/5 hover:bg-white/8 hover:border-gold/30 hover:text-gold text-xs font-medium tracking-wide flex items-center justify-between px-4"
                        >
                          <span className="flex items-center gap-2">
                            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current shrink-0 text-red-500" xmlns="http://www.w3.org/2000/svg">
                              <path d="M23.498 6.163a3.003 3.003 0 0 0-2.11-2.108C19.524 3.545 12 3.545 12 3.545s-7.525 0-9.387.51a3.003 3.003 0 0 0-2.11 2.108C0 8.025 0 12 0 12s0 3.975.503 5.837a3.003 3.003 0 0 0 2.11 2.108c1.862.51 9.387.51 9.387.51s7.525 0 9.387-.51a3.003 3.003 0 0 0 2.11-2.108C24 15.975 24 12 24 12s0-3.975-.502-5.837zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                            </svg>
                            Backup Feed 1
                          </span>
                          <ExternalLink className="w-4 h-4 opacity-50 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                        </Button>
                      </a>
                    )}
                    {backup2Url && (
                      <a href={backup2Url} target="_blank" rel="noopener noreferrer" className="block group">
                        <Button
                          variant="outline"
                          className="w-full h-12 rounded-xl border-white/10 bg-white/5 hover:bg-white/8 hover:border-gold/30 hover:text-gold text-xs font-medium tracking-wide flex items-center justify-between px-4"
                        >
                          <span className="flex items-center gap-2">
                            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current shrink-0 text-red-500" xmlns="http://www.w3.org/2000/svg">
                              <path d="M23.498 6.163a3.003 3.003 0 0 0-2.11-2.108C19.524 3.545 12 3.545 12 3.545s-7.525 0-9.387.51a3.003 3.003 0 0 0-2.11 2.108C0 8.025 0 12 0 12s0 3.975.503 5.837a3.003 3.003 0 0 0 2.11 2.108c1.862.51 9.387.51 9.387.51s7.525 0 9.387-.51a3.003 3.003 0 0 0 2.11-2.108C24 15.975 24 12 24 12s0-3.975-.502-5.837zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                            </svg>
                            Backup Feed 2
                          </span>
                          <ExternalLink className="w-4 h-4 opacity-50 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                        </Button>
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Instruction Tips */}
            <div className="rounded-xl border border-white/5 bg-black/30 p-4 space-y-3 text-xs leading-relaxed text-muted-foreground">
              <div className="flex items-start gap-2">
                <Tv className="w-4 h-4 text-gold shrink-0 mt-0.5" />
                <div>
                  <strong className="text-foreground">Casting to TV:</strong> Click the link to open the stream in your official YouTube App. Then, tap the cast icon at the top of the video to send the livestream directly to your Smart TV, Apple TV, or Chromecast.
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-gold shrink-0 mt-0.5" />
                <div>
                  <strong className="text-foreground">Stream Dropped?</strong> If the video freezes or ends unexpectedly, simply return to this page and select one of the backup feeds.
                </div>
              </div>
            </div>

          </div>

          {/* Bottom navigation */}
          <div className="text-center">
            <Link href="/watch" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-gold transition-colors">
              <span>Looking for the interactive chat or programme? Go to Interactive Player</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

        </div>
      </main>
    </div>
  )
}
