import { createServiceClient } from './supabase-server'
import { fetchYouTubeVideoMetadata } from './youtube-metadata'
import type { Stream } from './database.types'

type ServiceClient = ReturnType<typeof createServiceClient>

export async function getVerifiedLiveStream(supabase: ServiceClient) {
  const { data } = await supabase
    .from('streams')
    .select('*')
    .eq('is_live', true)
    .order('created_at', { ascending: false })
    .limit(5)

  const candidates = (data ?? []) as Stream[]

  for (const stream of candidates) {
    const metadata = await fetchYouTubeVideoMetadata(stream.youtube_video_id, { revalidate: 30 })

    if (metadata.broadcastStatus === 'ended') {
      await supabase
        .from('streams')
        .update({ is_live: false })
        .eq('id', stream.id)
      continue
    }

    // For 'live', 'waiting', or 'unknown' (rate-limited/network error),
    // we trust the database state and return the active stream.
    return stream
  }

  return null
}
