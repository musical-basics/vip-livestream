import { NextRequest } from 'next/server'
import { recordEmailOpen } from '@/lib/tracking'

// 1x1 transparent GIF.
const PIXEL = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
)

/**
 * GET /api/track/open?m=<member_id>
 * Email open tracking pixel. Records an open for the member (best effort) and
 * always returns a 1x1 transparent GIF. Public on purpose (loaded from email).
 */
export async function GET(request: NextRequest) {
  const memberId = request.nextUrl.searchParams.get('m')
  if (memberId) {
    await recordEmailOpen(memberId, request.headers.get('user-agent'))
  }
  return new Response(PIXEL, {
    status: 200,
    headers: {
      'Content-Type': 'image/gif',
      'Content-Length': String(PIXEL.length),
      'Cache-Control': 'no-store, no-cache, must-revalidate, private',
      Pragma: 'no-cache',
    },
  })
}
