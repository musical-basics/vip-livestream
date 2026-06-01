import { NextRequest } from 'next/server'

/**
 * Verifies the incoming request has a valid AGENT_API_KEY Bearer token.
 * Usage: if (!verifyAgentKey(request)) return unauthorized()
 */
export function verifyAgentKey(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return false

  const provided = authHeader.slice(7).trim()
  const expected = process.env.AGENT_API_KEY
  if (!expected) {
    console.error('⚠️ AGENT_API_KEY is not set in environment variables')
    return false
  }

  // Constant-time comparison to prevent timing attacks
  if (provided.length !== expected.length) return false
  let mismatch = 0
  for (let i = 0; i < provided.length; i++) {
    mismatch |= provided.charCodeAt(i) ^ expected.charCodeAt(i)
  }
  return mismatch === 0
}

export function agentUnauthorized() {
  return Response.json(
    { error: 'Unauthorized', hint: 'Provide a valid Bearer token in the Authorization header' },
    { status: 401 }
  )
}
