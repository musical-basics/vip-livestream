'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import type { Stream } from '@/lib/database.types'
import { Loader2, WifiOff, Clock, Play, Pause } from 'lucide-react'

interface VideoPlayerProps {
  stream: Stream | null
  fill?: boolean
}

declare global {
  interface Window {
    YT: any
    onYouTubeIframeAPIReady: () => void
  }
}

export default function VideoPlayer({ stream, fill = false }: VideoPlayerProps) {
  const playerRef = useRef<any>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const [playerState, setPlayerState] = useState<'loading' | 'ready' | 'offline'>('loading')
  const [isPlaying, setIsPlaying] = useState(false)
  const hasLiveVideo = !!stream?.is_live && !!stream.youtube_video_id

  const syncPlayer = useCallback(async () => {
    if (!playerRef.current || !stream?.is_live) return
    try {
      const res = await fetch('/api/stream/sync')
      if (!res.ok) return
      const data = await res.json()
      if (!data.is_live || data.offset_seconds === undefined) return

      const currentTime = playerRef.current.getCurrentTime?.() || 0
      const drift = Math.abs(currentTime - data.offset_seconds)

      // Only resync if drift > 5 seconds to avoid constant seeking
      if (drift > 5) {
        playerRef.current.seekTo(data.offset_seconds, true)
      }
    } catch (err) {
      console.error('Sync error:', err)
    }
  }, [stream])

  const initPlayer = useCallback(() => {
    if (!window.YT || !stream?.youtube_video_id) return

    playerRef.current = new window.YT.Player('yt-player', {
      width: '100%',
      height: '100%',
      videoId: stream.youtube_video_id,
      playerVars: {
        autoplay: 1,
        controls: 1,
        rel: 0,
        modestbranding: 1,
        playsinline: 1,
        color: 'white',
      },
      events: {
        onReady: async (event: any) => {
          setPlayerState('ready')
          // Initial sync
          try {
            const res = await fetch('/api/stream/sync')
            if (res.ok) {
              const data = await res.json()
              if (data.is_live && data.offset_seconds > 0) {
                event.target.seekTo(data.offset_seconds, true)
                event.target.playVideo()
                setIsPlaying(true)
              }
            }
          } catch {}

          // Start sync heartbeat every 30s
          syncIntervalRef.current = setInterval(syncPlayer, 30000)
        },
        onStateChange: (event: any) => {
          const playerStates = window.YT?.PlayerState
          setIsPlaying(event.data === playerStates?.PLAYING || event.data === 1)
        },
        onError: () => {
          setPlayerState('offline')
          setIsPlaying(false)
        },
      },
    })
  }, [stream, syncPlayer])

  const togglePlayback = useCallback(() => {
    if (!playerRef.current || playerState !== 'ready') return

    const playerStates = window.YT?.PlayerState
    const currentState = playerRef.current.getPlayerState?.()
    const playerIsPlaying =
      currentState === playerStates?.PLAYING ||
      currentState === playerStates?.BUFFERING ||
      currentState === 1 ||
      currentState === 3 ||
      isPlaying

    if (playerIsPlaying) {
      playerRef.current.pauseVideo?.()
      setIsPlaying(false)
      return
    }

    playerRef.current.playVideo?.()
    setIsPlaying(true)
  }, [isPlaying, playerState])

  useEffect(() => {
    if (!hasLiveVideo) {
      setPlayerState('loading')
      setIsPlaying(false)
      return
    }

    setPlayerState('loading')
    setIsPlaying(false)

    // Load YouTube IFrame API
    if (window.YT?.Player) {
      initPlayer()
    } else {
      const existingScript = document.getElementById('yt-api-script')
      if (!existingScript) {
        const script = document.createElement('script')
        script.id = 'yt-api-script'
        script.src = 'https://www.youtube.com/iframe_api'
        document.head.appendChild(script)
      }
      window.onYouTubeIframeAPIReady = initPlayer
    }

    return () => {
      if (syncIntervalRef.current) clearInterval(syncIntervalRef.current)
      if (playerRef.current?.destroy) playerRef.current.destroy()
    }
  }, [hasLiveVideo, initPlayer, stream?.youtube_video_id])

  if (!hasLiveVideo) {
    return (
      <div className={`${fill ? 'h-full' : 'aspect-video'} w-full bg-[oklch(0.08_0.01_270)] flex flex-col items-center justify-center gap-4`}>
        <Clock className="w-12 h-12 text-muted-foreground opacity-30" />
        <div className="text-center">
          <p className="text-lg font-light text-muted-foreground" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
            The performance will begin shortly
          </p>
          <p className="text-xs text-muted-foreground/50 mt-1">
            Please stay connected — we'll start when the artist is ready
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className={`relative w-full ${fill ? 'h-full' : 'aspect-video'} bg-black`} ref={containerRef}>
      {/* Loading overlay */}
      {playerState === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center bg-black z-10">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-[oklch(0.75_0.12_85)]" />
            <p className="text-xs text-muted-foreground">Loading stream…</p>
          </div>
        </div>
      )}

      {playerState === 'offline' && (
        <div className="absolute inset-0 flex items-center justify-center bg-[oklch(0.08_0.01_270)] z-10">
          <div className="flex flex-col items-center gap-3">
            <WifiOff className="w-8 h-8 text-muted-foreground opacity-40" />
            <p className="text-sm text-muted-foreground">Stream unavailable</p>
          </div>
        </div>
      )}

      {/* YouTube embed container */}
      <div id="yt-player" className="w-full h-full" />

      {playerState === 'ready' && (
        <button
          type="button"
          onClick={togglePlayback}
          aria-label={isPlaying ? 'Pause livestream' : 'Play livestream'}
          title={isPlaying ? 'Pause livestream' : 'Play livestream'}
          className="absolute left-4 top-4 z-20 flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-black/70 text-white shadow-lg shadow-black/30 backdrop-blur transition-colors hover:bg-black/85 focus:outline-none focus:ring-2 focus:ring-[oklch(0.75_0.12_85)]"
        >
          {isPlaying ? (
            <Pause className="h-5 w-5" aria-hidden="true" />
          ) : (
            <Play className="ml-0.5 h-5 w-5" aria-hidden="true" />
          )}
        </button>
      )}
    </div>
  )
}
