import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase-server'

// PATCH — update member (toggle moderator, ban)
export async function PATCH(request: NextRequest) {
  const member = await getSession()
  if (!member?.is_moderator) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { member_id, is_moderator, is_banned } = await request.json()
  if (!member_id) return NextResponse.json({ error: 'member_id required' }, { status: 400 })

  // Protect: cannot modify yourself
  if (member_id === member.id) {
    return NextResponse.json({ error: 'Cannot modify your own account' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const update: Record<string, any> = {}
  if (is_moderator !== undefined) update.is_moderator = is_moderator
  if (is_banned !== undefined) update.is_banned = is_banned

  const { error } = await supabase
    .from('members')
    .update(update)
    .eq('id', member_id)

  if (error) return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
  return NextResponse.json({ success: true })
}
