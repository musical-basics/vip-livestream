import { cookies } from 'next/headers'
import { createServiceClient } from './supabase-server'
import type { Member } from './database.types'

const SESSION_COOKIE = 'vip_session'

export async function getSession(): Promise<Member | null> {
  const cookieStore = await cookies()
  const memberId = cookieStore.get(SESSION_COOKIE)?.value
  if (!memberId) return null

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('members')
    .select('*')
    .eq('id', memberId)
    .eq('is_banned', false)
    .single()

  if (error || !data) return null
  return data
}

export async function setSession(memberId: string) {
  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE, memberId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
  })
}

export async function clearSession() {
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE)
}

export async function validatePasswordToken(token: string): Promise<Member | null> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('members')
    .select('*')
    .eq('password_token', token)
    .eq('is_banned', false)
    .single()

  if (error || !data) return null
  return data
}
