import { cookies } from 'next/headers'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { createServiceClient } from './supabase-server'
import type { Member } from './database.types'

const SESSION_COOKIE = 'vip_session'
const SESSION_MAX_AGE = 60 * 60 * 24 * 7 // 7 days

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

function getSessionSecret() {
  const secret = process.env.VIP_SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!secret) {
    throw new Error('Missing VIP_SESSION_SECRET or SUPABASE_SERVICE_ROLE_KEY')
  }
  return secret
}

function signMemberId(memberId: string) {
  return createHmac('sha256', getSessionSecret()).update(memberId).digest('hex')
}

function encodeSession(memberId: string) {
  return `${memberId}.${signMemberId(memberId)}`
}

function decodeSession(value: string) {
  const [memberId, signature] = value.split('.')
  if (!memberId || !signature) return null

  const expected = signMemberId(memberId)
  const actualBuffer = Buffer.from(signature, 'hex')
  const expectedBuffer = Buffer.from(expected, 'hex')

  if (actualBuffer.length !== expectedBuffer.length) return null
  return timingSafeEqual(actualBuffer, expectedBuffer) ? memberId : null
}

export async function getSession(): Promise<Member | null> {
  const cookieStore = await cookies()
  const sessionValue = cookieStore.get(SESSION_COOKIE)?.value
  const memberId = sessionValue ? decodeSession(sessionValue) : null
  if (!memberId) return null

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('members')
    .select('*')
    .eq('id', memberId)
    .eq('is_banned', false)
    .single()

  if (error) {
    console.error('❌ getSession Supabase error:', error)
  }
  if (!data) return null
  return data
}

export async function setSession(memberId: string) {
  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE, encodeSession(memberId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE,
    path: '/',
  })
}

export async function clearSession() {
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE)
}

export async function validateMemberCredentials(
  email: string,
  assignedPassword: string
): Promise<Member | null> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('members')
    .select('*')
    .eq('email', normalizeEmail(email))
    .eq('password_token', assignedPassword.trim())
    .eq('is_banned', false)
    .maybeSingle()

  if (error) {
    console.error('❌ validateMemberCredentials Supabase error:', error)
  }
  return data ?? null
}
