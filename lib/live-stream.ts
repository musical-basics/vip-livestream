import { createServiceClient } from './supabase-server'
import type { Stream } from './database.types'

type ServiceClient = ReturnType<typeof createServiceClient>

export async function getVerifiedLiveStream(supabase: ServiceClient) {
  const { data } = await supabase
    .from('streams')
    .select('*')
    .eq('is_live', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return (data as Stream) || null
}
