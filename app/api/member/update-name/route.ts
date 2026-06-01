import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase-server'

export async function POST(request: NextRequest) {
  const member = await getSession()
  if (!member) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { display_name } = await request.json()
  if (!display_name?.trim()) {
    return NextResponse.json({ error: 'Name required' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { error } = await supabase
    .from('members')
    .update({ display_name: display_name.trim() })
    .eq('id', member.id)

  if (error) return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
  return NextResponse.json({ success: true })
}
