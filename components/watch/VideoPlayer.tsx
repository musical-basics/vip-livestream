'use client'

import { useEffect, useRef, useCallback, useState, useMemo } from 'react'
import type { Stream } from '@/lib/database.types'
import { Loader2, WifiOff, Clock, Play, Pause, Volume2, Settings } from 'lucide-react'

interface VideoPlayerProps {
  stream: Stream | null
  fill?: boolean
  videoId?: string | null
  onPlaybackError?: (errorVideoId: string) => void
  /** When false, the player loads paused (no autoplay). Used for the admin/test
   *  account so their tab doesn't auto-play audio while testing the stream. */
  autoplay?: boolean
  /** Play a finished broadcast's recording even though the stream is no longer
   *  marked live (the waiting-room placeholder is skipped). */
  replay?: boolean
  /** Reports the current playback position while playing — drives chat replay. */
  onTimeUpdate?: (seconds: number) => void
}

type PlayerStatus = 'loading' | 'ready' | 'offline'

interface YouTubePlayer {
  destroy?: () => void
  getPlayerState?: () => number
  getCurrentTime?: () => number
  pauseVideo?: () => void
  playVideo?: () => void
  mute?: () => void
  unMute?: () => void
  getAvailableQualityLevels?: () => string[]
  setPlaybackQuality?: (suggestedQuality: string) => void
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

const QUALITY_LABELS: Record<string, string> = {
  highres: 'Source',
  hd1080: '1080p',
  hd720: '720p',
  large: '480p',
  medium: '360p',
  small: '240p',
  tiny: '240p',
  default: 'Auto',
}

export default function VideoPlayer({
  stream,
  fill = false,
  videoId: selectedVideoId,
  onPlaybackError,
  autoplay = true,
  replay = false,
  onTimeUpdate,
}: VideoPlayerProps) {
  const videoId = selectedVideoId?.trim() || stream?.youtube_video_id?.trim() || null
  const playerRef = useRef<YouTubePlayer | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const playerElementRef = useRef<HTMLDivElement>(null)
  const [playback, setPlayback] = useState<{
    isPlaying: boolean
    playerState: PlayerStatus
    videoId: string | null
  }>({ isPlaying: false, playerState: 'loading', videoId: null })
  const [isPlayerMuted, setIsPlayerMuted] = useState(true)
  const [selectedQuality, setSelectedQuality] = useState<string>('default')
  const [availableQualities, setAvailableQualities] = useState<string[]>([])
  const [showQualityMenu, setShowQualityMenu] = useState(false)

  const hasLiveVideo = (!!stream?.is_live || replay) && !!videoId
  const playerState = playback.videoId === videoId ? playback.playerState : 'loading'
  const isPlaying = playback.videoId === videoId ? playback.isPlaying : false

  const isSwitching = playback.videoId !== null && playback.videoId !== videoId
  const loadingText = isSwitching ? 'Loading backup stream, please wait…' : 'Loading, please wait…'

  const qualityOptions = useMemo(() => {
    const opts = ['default']
    availableQualities.forEach((q) => {
      if (q !== 'default' && QUALITY_LABELS[q] && !opts.includes(q)) {
        opts.push(q)
      }
    })
    return opts
  }, [availableQualities])

  useEffect(() => {
    if (!showQualityMenu) return

    function handleGlobalClose(e: Event) {
      if ((e.target as Element).closest('.quality-menu-container')) {
        return
      }
      setShowQualityMenu(false)
    }

    window.addEventListener('pointerdown', handleGlobalClose, true)
    return () => window.removeEventListener('pointerdown', handleGlobalClose, true)
  }, [showQualityMenu])

  const initPlayer = useCallback(() => {
    const playerElement = playerElementRef.current
    if (!window.YT?.Player || !playerElement || !videoId) return

    if (playerRef.current?.destroy) {
      try {
        playerRef.current.destroy()
      } catch (err) {
        console.error('Error destroying player:', err)
      }
      playerRef.current = null
    }

    playerElement.innerHTML = ''

    const ytAnchor = document.createElement('div')
    ytAnchor.className = 'w-full h-full'
    playerElement.appendChild(ytAnchor)

    playerRef.current = new window.YT.Player(ytAnchor, {
      width: '100%',
      height: '100%',
      videoId,
      playerVars: {
        autoplay: autoplay ? 1 : 0,
        controls: 1,
        rel: 0,
        modestbranding: 1,
        playsinline: 1,
        color: 'white',
        enablejsapi: 1,
        origin: window.location.origin,
        mute: 1, // Start muted for reliable autoplay support
      },
      events: {
        onReady: (event) => {
          try {
            const isMutedPref = localStorage.getItem('watch_player_muted') !== 'false'
            if (isMutedPref) {
              event.target.mute?.()
              setIsPlayerMuted(true)
            } else {
              event.target.unMute?.()
              setIsPlayerMuted(false)
            }
            if (event.target.getAvailableQualityLevels) {
              const levels = event.target.getAvailableQualityLevels()
              setAvailableQualities(levels)
            }
            if (event.target.setPlaybackQuality) {
              event.target.setPlaybackQuality('default')
            }
            if (autoplay) {
              event.target.playVideo?.()
              setPlayback({ isPlaying: true, playerState: 'ready', videoId })
            } else {
              // Admin/test account: load paused so it doesn't blast audio during testing.
              setPlayback({ isPlaying: false, playerState: 'ready', videoId })
            }
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
          if (onPlaybackError) {
            onPlaybackError(videoId)
          }
        },
      },
    })
  }, [videoId, onPlaybackError, autoplay])

  const unmutePlayer = useCallback(() => {
    if (!playerRef.current) return
    try {
      playerRef.current.unMute?.()
      setIsPlayerMuted(false)
      localStorage.setItem('watch_player_muted', 'false')
    } catch (err) {
      console.error('YouTube unmute error:', err)
    }
  }, [])

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
  }, [hasLiveVideo, initPlayer, videoId])

  // Surface the playback position so the chat replay can stay in sync. Polling
  // (rather than state) keeps the once-per-tick update out of React's render
  // path — the consumer stores it in a ref.
  useEffect(() => {
    if (!onTimeUpdate || playerState !== 'ready') return

    const interval = window.setInterval(() => {
      const seconds = playerRef.current?.getCurrentTime?.()
      if (typeof seconds === 'number' && Number.isFinite(seconds)) {
        onTimeUpdate(seconds)
      }
    }, 500)

    return () => window.clearInterval(interval)
  }, [onTimeUpdate, playerState])

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
            <p className="text-xs text-muted-foreground">{loadingText}</p>
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

      {playerState === 'ready' && (
        <div className="quality-menu-container absolute right-4 top-4 z-20 flex flex-col items-end gap-1.5">
          <button
            type="button"
            onClick={() => setShowQualityMenu((v) => !v)}
            aria-label="Playback settings"
            title="Playback settings"
            className="flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-black/70 text-white shadow-lg shadow-black/30 backdrop-blur transition-colors hover:bg-black/85 focus:outline-none focus:ring-2 focus:ring-[oklch(0.75_0.12_85)]"
          >
            <Settings className={`h-5 w-5 transition-transform duration-200 ${showQualityMenu ? 'rotate-45 text-[oklch(0.75_0.12_85)]' : ''}`} />
          </button>
          
          {showQualityMenu && qualityOptions.length > 0 && (
            <div className="bg-black/90 border border-white/10 rounded-xl p-1 shadow-2xl backdrop-blur-md min-w-[120px] animate-[fadeIn_0.15s_ease-out] flex flex-col gap-0.5">
              <p className="text-[9px] text-muted-foreground/60 px-2.5 py-1 uppercase tracking-widest font-semibold select-none">Quality</p>
              {qualityOptions.map((opt) => {
                const isSelected = selectedQuality === opt
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => {
                      if (playerRef.current?.setPlaybackQuality) {
                        playerRef.current.setPlaybackQuality(opt)
                      }
                      setSelectedQuality(opt)
                      setShowQualityMenu(false)
                    }}
                    className={`text-left text-xs px-2.5 py-1.5 rounded-lg transition-colors font-medium flex items-center justify-between ${
                      isSelected
                        ? 'bg-[oklch(0.75_0.12_85)]/15 text-[oklch(0.75_0.12_85)] font-semibold'
                        : 'text-muted-foreground hover:bg-white/5 hover:text-foreground'
                    }`}
                  >
                    <span>{QUALITY_LABELS[opt] || opt}</span>
                    {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-[oklch(0.75_0.12_85)]" />}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {playerState === 'ready' && isPlayerMuted && (
        <button
          type="button"
          onClick={unmutePlayer}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 rounded-xl text-black px-4 py-2.5 text-sm font-semibold shadow-lg hover:scale-105 active:scale-95 transition-all duration-100 animate-bounce"
          style={{ background: 'linear-gradient(135deg, oklch(0.85 0.16 90), oklch(0.75 0.12 85))' }}
        >
          <Volume2 className="w-4 h-4 shrink-0" />
          <span>Click to Unmute Audio 🔊</span>
        </button>
      )}
    </div>
  )
}
