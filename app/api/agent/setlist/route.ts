import { NextRequest } from 'next/server'
import { verifyAgentKey, agentUnauthorized } from '@/lib/agent-auth'
import {
  getStoredSetlist,
  saveSetlist,
  deleteSetlist,
  listSetlists,
  SETLIST_SLUGS,
  PROGRAMME_SLUG,
} from '@/lib/setlist-store'
import { SETLIST_API_DOCS } from '@/lib/setlist-api-docs'

/**
 * GET /api/agent/setlist
 *   List every stored setlist document (slug + data + timestamps), with the
 *   full usage instructions in `instructions` so an agent can self-serve.
 * GET /api/agent/setlist?slug=programme
 *   Return one stored document, or 404 if none exists (code default is in use).
 *
 * The same instructions are mirrored in docs/agent-setlist-api.md.
 */
export async function GET(request: NextRequest) {
  if (!verifyAgentKey(request)) return agentUnauthorized()

  const slug = request.nextUrl.searchParams.get('slug')

  if (slug) {
    const data = await getStoredSetlist(slug)
    if (data === null) {
      return Response.json(
        {
          error: 'No stored setlist for this slug; the code default is in use.',
          slug,
          instructions: SETLIST_API_DOCS,
        },
        { status: 404 }
      )
    }
    return Response.json({ slug, data })
  }

  const { data, error } = await listSetlists()
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({
    slugs: SETLIST_SLUGS,
    setlists: data ?? [],
    instructions: SETLIST_API_DOCS,
  })
}

/**
 * PUT /api/agent/setlist
 * Create or overwrite a setlist document.
 * Body: { slug, data }
 *   slug 'programme'       -> data must be a SetlistItem[] (viewer programme)
 *   slug 'belgium-tracker' -> data is the full tracker object (see /setlist)
 */
export async function PUT(request: NextRequest) {
  if (!verifyAgentKey(request)) return agentUnauthorized()

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json(
      { error: 'Invalid JSON body', instructions: SETLIST_API_DOCS },
      { status: 400 }
    )
  }

  const { slug, data } = (body ?? {}) as { slug?: unknown; data?: unknown }

  if (typeof slug !== 'string' || !slug.trim()) {
    return Response.json(
      { error: 'slug (string) is required', instructions: SETLIST_API_DOCS },
      { status: 400 }
    )
  }
  if (data === undefined || data === null) {
    return Response.json(
      { error: 'data is required', instructions: SETLIST_API_DOCS },
      { status: 400 }
    )
  }

  // The viewer programme must be a non-empty array of pieces, otherwise /watch
  // would silently fall back to the code default and the write would look lost.
  if (slug === PROGRAMME_SLUG && (!Array.isArray(data) || data.length === 0)) {
    return Response.json(
      {
        error: `data for slug '${PROGRAMME_SLUG}' must be a non-empty array of setlist items`,
        instructions: SETLIST_API_DOCS,
      },
      { status: 400 }
    )
  }

  const { data: row, error } = await saveSetlist(slug.trim(), data)
  if (error || !row) {
    return Response.json({ error: error?.message ?? 'Failed to save setlist' }, { status: 500 })
  }

  return Response.json({ ok: true, setlist: row })
}

/** PATCH is an alias for PUT (full-document upsert). */
export const PATCH = PUT

/**
 * DELETE /api/agent/setlist
 * Remove a stored document so the slug reverts to its code default.
 * Body: { slug }  (or ?slug= query param)
 */
export async function DELETE(request: NextRequest) {
  if (!verifyAgentKey(request)) return agentUnauthorized()

  let slug = request.nextUrl.searchParams.get('slug') ?? ''
  if (!slug) {
    try {
      const body = (await request.json()) as { slug?: unknown }
      if (typeof body?.slug === 'string') slug = body.slug
    } catch {
      // no body, fall through to validation below
    }
  }

  if (!slug.trim()) {
    return Response.json(
      { error: 'slug is required', instructions: SETLIST_API_DOCS },
      { status: 400 }
    )
  }

  const { error } = await deleteSetlist(slug.trim())
  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ ok: true, deleted: slug.trim() })
}
