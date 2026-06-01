// eslint-disable-next-line @typescript-eslint/no-explicit-any
import { createClient } from '@supabase/supabase-js'

/** Service role client — bypasses RLS. Use server-side only. */
export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      db: {
        schema: 'vip_livestream',
      },
    }
  )
}

/** Anon client for server-side reads (no Realtime) */
export function createAnonClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      db: {
        schema: 'vip_livestream',
      },
    }
  )
}
