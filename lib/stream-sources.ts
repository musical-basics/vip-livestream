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

export function getStreamSources(stream: Stream | null): StreamSource[] {
  return [
    {
      id: 'main',
      label: 'Main Stream',
      videoId: stream?.youtube_video_id ?? null,
    },
    {
      id: 'backup1',
      label: 'Backup Stream 1',
      videoId: stream?.backup_youtube_video_id_1 ?? null,
    },
    {
      id: 'backup2',
      label: 'Backup Stream 2',
      videoId: stream?.backup_youtube_video_id_2 ?? null,
    },
  ]
}

export function getAvailableStreamSources(stream: Stream | null): AvailableStreamSource[] {
  return getStreamSources(stream).filter((source): source is AvailableStreamSource => !!source.videoId)
}
