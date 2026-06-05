'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import type { Stream } from '@/lib/database.types'
import { Loader2, WifiOff, Clock, Play, Pause } from 'lucide-react'

interface VideoPlayerProps {
  stream: Stream | null
  fill?: boolean
}

type PlayerStatus = 'loading' | 'ready' | 'offline'

interface YouTubePlayer {
  destroy?: () => void
  getPlayerState?: () => number
  pauseVideo?: () => void
  playVideo?: () => void
}

interface YouTubePlayerEvent {
  data: number
  target: YouTubePlayer
}

interface YouTubePlayerOptions {
  width: string
  height: string
  videoId: string
  playerVars: Record<string, number | string>
  events: {
    onReady: (event: YouTubePlayerEvent) => void
    onStateChange: (event: YouTubePlayerEvent) => void
    onError: () => void
  }
}

declare global {
  interface Window {
    YT?: {
      Player?: new (element: HTMLElement, options: YouTubePlayerOptions) => YouTubePlayer
      PlayerState?: {
        BUFFERING: number
        PLAYING: number
      }
    }
    onYouTubeIframeAPIReady?: () => void
  }
}

export default function VideoPlayer({ stream, fill = false }: VideoPlayerProps) {
  const videoId = stream?.youtube_video_id
  const playerRef = useRef<YouTubePlayer | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const playerElementRef = useRef<HTMLDivElement>(null)
  const [playback, setPlayback] = useState<{
    isPlaying: boolean
    playerState: PlayerStatus
    videoId: string | null
  }>({ isPlaying: false, playerState: 'loading', videoId: null })
  const hasLiveVideo = !!stream?.is_live && !!videoId
  const playerState = playback.videoId === videoId ? playback.playerState : 'loading'
  const isPlaying = playback.videoId === videoId ? playback.isPlaying : false

  const initPlayer = useCallback(() => {
    if (!window.YT?.Player || !playerElementRef.current || !videoId) return

    if (playerRef.current?.destroy) {
      playerRef.current.destroy()
      playerRef.current = null
    }

    playerRef.current = new window.YT.Player(playerElementRef.current, {
      width: '100%',
      height: '100%',
      videoId,
      playerVars: {
        autoplay: 1,
        controls: 1,
        rel: 0,
        modestbranding: 1,
        playsinline: 1,
        color: 'white',
      },
      events: {
        onReady: (event) => {
          try {
            event.target.playVideo?.()
            setPlayback({ isPlaying: true, playerState: 'ready', videoId })
          } catch (err) {
            console.error('YouTube play error:', err)
            setPlayback({ isPlaying: false, playerState: 'ready', videoId })
          }
        },
        onStateChange: (event) => {
          const playerStates = window.YT?.PlayerState
          setPlayback((current) => ({
            isPlaying: event.data === playerStates?.PLAYING || event.data === 1,
            playerState: current.videoId === videoId ? current.playerState : 'ready',
            videoId,
          }))
        },
        onError: () => {
          setPlayback({ isPlaying: false, playerState: 'offline', videoId })
        },
      },
    })
  }, [videoId])

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
      try {
        playerRef.current.pauseVideo?.()
      } catch (err) {
        console.error('YouTube pause error:', err)
      }
      setPlayback((current) => ({ ...current, isPlaying: false }))
      return
    }

    try {
      playerRef.current.playVideo?.()
      setPlayback((current) => ({ ...current, isPlaying: true }))
    } catch (err) {
      console.error('YouTube play error:', err)
      setPlayback((current) => ({ ...current, isPlaying: false }))
    }
  }, [isPlaying, playerState])

  useEffect(() => {
    if (!hasLiveVideo) {
      return
    }

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
      if (playerRef.current?.destroy) {
        playerRef.current.destroy()
        playerRef.current = null
      }
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
            Please stay connected — we will start when the artist is ready
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
      <div ref={playerElementRef} className="w-full h-full" />

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
