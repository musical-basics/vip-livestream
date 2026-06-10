import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Archive, ArrowLeft, ExternalLink, Clock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { getSession } from '@/lib/auth'
import { isAdmin } from '@/lib/roles'
import { createServiceClient } from '@/lib/supabase-server'
import { fetchYouTubeVideoMetadata } from '@/lib/youtube-metadata'
import type { Stream } from '@/lib/database.types'

function formatDuration(totalSeconds: number | null) {
  if (totalSeconds === null) return 'Duration unavailable'

  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }

  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

function formatDate(value: string | null) {
  if (!value) return 'Date unavailable'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

/**
 * The archived recordings are test captures, so they are restricted to the
 * dedicated test account. Everyone else gets a blank screen (no list, no
 * "no recordings" copy) until real, public recordings are intentionally opened up.
 */
const RECORDINGS_ALLOWED_EMAIL = 'test@musicalbasics.com'

export default async function RecordingsPage() {
  const member = await getSession()
  if (!member) redirect('/')

  if (member.email?.toLowerCase() !== RECORDINGS_ALLOWED_EMAIL) {
    return <main className="min-h-[100dvh]" />
  }

  const supabase = createServiceClient()
  const { data } = await supabase
    .from('streams')
    .select('*')
    .eq('is_live', false)
    .neq('youtube_video_id', '')
    .order('created_at', { ascending: false })

  const recordings = (data ?? []) as Stream[]
  const durations = await Promise.all(
    recordings.map(async (stream) => {
      const metadata = await fetchYouTubeVideoMetadata(stream.youtube_video_id, {
        revalidate: 60 * 60 * 6,
      })
      return [stream.id, metadata.durationSeconds] as const
    })
  )
  const durationByStreamId = new Map(durations)

  return (
    <main className="min-h-[100dvh]">
      <header className="glass-heavy flex flex-wrap items-center gap-3 border-b border-border/50 px-4 py-4 sm:px-6">
        <Link
          href={isAdmin(member) ? '/admin' : '/watch'}
          className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {isAdmin(member) ? 'Back to Admin' : 'Back to Livestream'}
        </Link>
        <div className="flex items-center gap-2">
          <Archive className="h-4 w-4 text-[oklch(0.75_0.12_85)]" />
          <h1
            className="text-lg font-light text-gold"
            style={{ fontFamily: "'Cormorant Garamond', serif" }}
          >
            Recordings
          </h1>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <div className="mb-6 max-w-2xl">
          <p className="text-sm text-muted-foreground">
            Rewatch past livestream performances.
          </p>
        </div>

        {recordings.length === 0 ? (
          <div className="glass rounded-2xl p-8 text-center">
            <Archive className="mx-auto mb-3 h-8 w-8 text-muted-foreground opacity-40" />
            <p className="text-sm text-muted-foreground">No archived recordings yet.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {recordings.map((stream) => (
              <article key={stream.id} className="glass overflow-hidden rounded-2xl">
                <div className="aspect-video w-full bg-black">
                  <iframe
                    title={`${stream.title} recording`}
                    src={`https://www.youtube.com/embed/${stream.youtube_video_id}`}
                    className="h-full w-full"
                    allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                  />
                </div>
                <div className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2
                        className="truncate text-xl font-light text-foreground"
                        style={{ fontFamily: "'Cormorant Garamond', serif" }}
                      >
                        {stream.title}
                      </h2>
                      {isAdmin(member) && (
                        <p className="mt-1 font-mono text-xs text-muted-foreground">
                          ID: {stream.youtube_video_id}
                        </p>
                      )}
                    </div>
                    <Badge variant="outline" className="border-white/15 text-[10px] text-muted-foreground">
                      ARCHIVED
                    </Badge>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" />
                      {formatDate(stream.stream_start_utc ?? stream.created_at)}
                    </span>
                    <span>{formatDuration(durationByStreamId.get(stream.id) ?? null)}</span>
                  </div>

                  {stream.description && (
                    <p className="text-sm text-muted-foreground">{stream.description}</p>
                  )}

                  <Button asChild variant="outline" className="w-full rounded-xl">
                    <a
                      href={`https://youtube.com/watch?v=${stream.youtube_video_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Open on YouTube
                    </a>
                  </Button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
