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
    const metadata = await fetchYouTubeVideoMetadata(stream.youtube_video_id, { cache: 'no-store' })

    if (metadata.broadcastStatus === 'live') {
      return stream
    }

    if (metadata.broadcastStatus === 'ended') {
      await supabase
        .from('streams')
        .update({ is_live: false })
        .eq('id', stream.id)
    }
  }

  return null
}
