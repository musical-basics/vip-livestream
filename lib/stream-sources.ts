import type { Stream } from './database.types'

export type StreamSourceId = 'main' | 'backup1' | 'backup2'

export interface StreamSource {
  id: StreamSourceId
  label: string
  videoId: string | null
}

export interface AvailableStreamSource extends StreamSource {
  videoId: string
}

function normalizeVideoId(videoId: string | null | undefined) {
  const trimmedVideoId = videoId?.trim() ?? ''
  return trimmedVideoId || null
}

export function getStreamSources(stream: Stream | null): StreamSource[] {
  return [
    {
      id: 'main',
      label: 'Main Stream',
      videoId: normalizeVideoId(stream?.youtube_video_id),
    },
    {
      id: 'backup1',
      label: 'Backup Stream 1',
      videoId: normalizeVideoId(stream?.backup_youtube_video_id_1),
    },
    {
      id: 'backup2',
      label: 'Backup Stream 2',
      videoId: normalizeVideoId(stream?.backup_youtube_video_id_2),
    },
  ]
}

export function getAvailableStreamSources(stream: Stream | null): AvailableStreamSource[] {
  return getStreamSources(stream).filter((source): source is AvailableStreamSource => !!source.videoId)
}
