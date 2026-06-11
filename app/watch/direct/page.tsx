import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { getVerifiedLiveStream } from '@/lib/live-stream'
import { createServiceClient } from '@/lib/supabase-server'
import DirectWatchPageClient from '@/components/watch/DirectWatchPageClient'
import type { Stream } from '@/lib/database.types'

export default async function DirectWatchPage() {
  const member = await getSession()
  if (!member) {
    redirect('/?redirectTo=/watch/direct')
  }

  const supabase = createServiceClient()
  const stream: Stream | null = await getVerifiedLiveStream(supabase)

  let activeStream = stream
  if (!activeStream) {
    const { data: newestStream } = await supabase
      .from('streams')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    activeStream = newestStream ?? null
  }

  return (
    <DirectWatchPageClient
      member={member}
      stream={activeStream}
    />
  )
}
