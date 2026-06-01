import { NextRequest, NextResponse } from 'next/server'

export function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl

  // Allow public routes
  if (
    pathname === '/' ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/api/stripe/webhook') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon')
  ) {
    return NextResponse.next()
  }

  // Protect /watch and other routes
  const sessionCookie = request.cookies.get('vip_session')
  if (!sessionCookie?.value) {
    const loginUrl = new URL('/', request.url)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/watch/:path*', '/api/stream/:path*', '/api/tip/:path*'],
}
