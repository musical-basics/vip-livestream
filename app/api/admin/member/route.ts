import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { isAdmin } from '@/lib/roles'
import { normalizeMemberBadges } from '@/lib/member-badges'
import { createServiceClient } from '@/lib/supabase-server'

// PATCH — update member (badges, moderator, admin, ban). Admin only.
export async function PATCH(request: NextRequest) {
  const member = await getSession()
  if (!isAdmin(member)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { member_id, is_moderator, is_admin, is_banned, access_badges } = await request.json()
  if (!member_id) return NextResponse.json({ error: 'member_id required' }, { status: 400 })

  // Protect: cannot modify yourself (e.g. cannot remove your own admin or ban yourself)
  if (member_id === member!.id) {
    return NextResponse.json({ error: 'Cannot modify your own account' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const update: Record<string, unknown> = {}
  if (is_moderator !== undefined) update.is_moderator = is_moderator
  if (is_admin !== undefined) update.is_admin = is_admin
  if (is_banned !== undefined) update.is_banned = is_banned
  if (access_badges !== undefined) update.access_badges = normalizeMemberBadges(access_badges)

  const { data, error } = await supabase
    .from('members')
    .update(update)
    .eq('id', member_id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
  return NextResponse.json({ success: true, member: data })
}
