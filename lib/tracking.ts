// Server-only tracking helpers for login events and email opens.
// All helpers are defensive: if the tables don't exist yet (migration not run)
// or a query fails, they swallow the error so nothing user-facing breaks.
import { createServiceClient } from '@/lib/supabase-server'

export type LoginReason = 'ok' | 'bad_password' | 'no_member' | 'banned'

/** Record one login attempt. Never throws. */
export async function recordLoginEvent(input: {
  email: string
  memberId?: string | null
  success: boolean
  reason: LoginReason
  userAgent?: string | null
}) {
  try {
    const supabase = createServiceClient()
    await supabase.from('login_events').insert({
      email: input.email.trim().toLowerCase(),
      member_id: input.memberId ?? null,
      success: input.success,
      reason: input.reason,
      user_agent: input.userAgent ?? null,
    })
  } catch (e) {
    console.error('recordLoginEvent failed:', e)
  }
}

/** Record one email open (tracking pixel hit). Never throws. */
export async function recordEmailOpen(memberId: string, userAgent?: string | null) {
  try {
    const supabase = createServiceClient()
    await supabase.from('email_opens').insert({ member_id: memberId, user_agent: userAgent ?? null })
  } catch (e) {
    console.error('recordEmailOpen failed:', e)
  }
}

export interface LoginEventRow {
  id: string
  member_id: string | null
  email: string
  success: boolean
  reason: string | null
  created_at: string
}

/** Recent login attempts, newest first. Returns [] on error. */
export async function getRecentLoginEvents(limit = 300): Promise<LoginEventRow[]> {
  try {
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('login_events')
      .select('id, member_id, email, success, reason, created_at')
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) return []
    return (data ?? []) as LoginEventRow[]
  } catch {
    return []
  }
}

export interface MemberParticipation {
  id: string
  name: string
  email: string
  is_banned: boolean
  emailOpens: number
  firstOpenAt: string | null
  loginSuccesses: number
  loginFailures: number
  lastLoginAt: string | null
  messages: number
  participated: boolean
}

/**
 * Per-member participation rolled up from email_opens, login_events and
 * chat_messages. "participated" = logged in successfully at least once OR sent
 * a chat message. Returns [] on error.
 */
export async function getMemberParticipation(): Promise<MemberParticipation[]> {
  try {
    const supabase = createServiceClient()
    const [membersRes, opensRes, loginsRes, messagesRes] = await Promise.all([
      supabase.from('members').select('id, name, email, is_banned').order('name'),
      supabase.from('email_opens').select('member_id, created_at'),
      supabase.from('login_events').select('member_id, email, success, created_at'),
      supabase.from('chat_messages').select('member_id'),
    ])

    const members = (membersRes.data ?? []) as Array<{
      id: string; name: string; email: string; is_banned: boolean
    }>

    const opens = (opensRes.data ?? []) as Array<{ member_id: string; created_at: string }>
    const logins = (loginsRes.data ?? []) as Array<{
      member_id: string | null; email: string; success: boolean; created_at: string
    }>
    const messages = (messagesRes.data ?? []) as Array<{ member_id: string }>

    const opensByMember = new Map<string, { count: number; first: string | null }>()
    for (const o of opens) {
      const cur = opensByMember.get(o.member_id) ?? { count: 0, first: null }
      cur.count += 1
      if (!cur.first || o.created_at < cur.first) cur.first = o.created_at
      opensByMember.set(o.member_id, cur)
    }

    const msgByMember = new Map<string, number>()
    for (const m of messages) msgByMember.set(m.member_id, (msgByMember.get(m.member_id) ?? 0) + 1)

    // Logins keyed by member_id when present, else matched by email.
    const emailToId = new Map(members.map((m) => [m.email.toLowerCase(), m.id]))
    const loginAgg = new Map<string, { ok: number; fail: number; last: string | null }>()
    for (const l of logins) {
      const id = l.member_id ?? emailToId.get((l.email || '').toLowerCase())
      if (!id) continue
      const cur = loginAgg.get(id) ?? { ok: 0, fail: 0, last: null }
      if (l.success) {
        cur.ok += 1
        if (!cur.last || l.created_at > cur.last) cur.last = l.created_at
      } else {
        cur.fail += 1
      }
      loginAgg.set(id, cur)
    }

    return members.map((m) => {
      const o = opensByMember.get(m.id)
      const lg = loginAgg.get(m.id)
      const messagesCount = msgByMember.get(m.id) ?? 0
      const loginSuccesses = lg?.ok ?? 0
      return {
        id: m.id,
        name: m.name,
        email: m.email,
        is_banned: m.is_banned,
        emailOpens: o?.count ?? 0,
        firstOpenAt: o?.first ?? null,
        loginSuccesses,
        loginFailures: lg?.fail ?? 0,
        lastLoginAt: lg?.last ?? null,
        messages: messagesCount,
        participated: loginSuccesses > 0 || messagesCount > 0,
      }
    })
  } catch {
    return []
  }
}
