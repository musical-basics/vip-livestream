// Server-only: uses the Supabase service-role client. Import from server
// components and API routes, never from client components.
import { createServiceClient } from '@/lib/supabase-server'
import type { SetlistItem } from '@/lib/database.types'
import { DEFAULT_SETLIST } from '@/lib/default-setlist'
import { DEFAULT_BELGIUM_TRACKER, type BelgiumTracker } from '@/lib/belgium-setlist'

/**
 * Stable slugs for the named setlist documents stored in
 * vip_livestream.setlists. Each maps to one JSON document that the agent API
 * can read and overwrite; when no row exists the code default is used.
 */
export const PROGRAMME_SLUG = 'programme'
export const BELGIUM_TRACKER_SLUG = 'belgium-tracker'
export const SETLIST_SLUGS = [PROGRAMME_SLUG, BELGIUM_TRACKER_SLUG] as const

/** Raw stored JSON for a slug, or null if no row exists / on error. */
export async function getStoredSetlist(slug: string): Promise<unknown | null> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('setlists')
    .select('data')
    .eq('slug', slug)
    .maybeSingle()

  if (error || !data) return null
  return data.data
}

/**
 * Viewer programme used as the global fallback on /watch (when a stream has no
 * own setlist). Resolves to the stored 'programme' document, else the code
 * default in lib/default-setlist.ts.
 */
export async function getProgramme(): Promise<SetlistItem[]> {
  const stored = await getStoredSetlist(PROGRAMME_SLUG)
  if (Array.isArray(stored) && stored.length > 0) {
    return stored as SetlistItem[]
  }
  return DEFAULT_SETLIST
}

/**
 * Full Belgium production tracker for /setlist. Resolves to the stored
 * 'belgium-tracker' document, else the code default.
 */
export async function getBelgiumTracker(): Promise<BelgiumTracker> {
  const stored = await getStoredSetlist(BELGIUM_TRACKER_SLUG)
  if (stored && typeof stored === 'object' && !Array.isArray(stored)) {
    return stored as BelgiumTracker
  }
  return DEFAULT_BELGIUM_TRACKER
}

/** Upsert (create or overwrite) the JSON document for a slug. */
export async function saveSetlist(slug: string, data: unknown) {
  const supabase = createServiceClient()
  return supabase
    .from('setlists')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .upsert({ slug, data: data as any, updated_at: new Date().toISOString() }, { onConflict: 'slug' })
    .select()
    .single()
}

/** Delete the stored document for a slug, reverting to the code default. */
export async function deleteSetlist(slug: string) {
  const supabase = createServiceClient()
  return supabase.from('setlists').delete().eq('slug', slug)
}

/** List all stored setlist documents (slug + data + timestamps). */
export async function listSetlists() {
  const supabase = createServiceClient()
  return supabase
    .from('setlists')
    .select('slug, data, updated_at, created_at')
    .order('slug', { ascending: true })
}
