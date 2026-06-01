import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase-server'

export async function POST(request: NextRequest) {
  const member = await getSession()
  if (!member) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { stream_id, content, display_name } = await request.json()

  if (!content?.trim()) {
    return NextResponse.json({ error: 'Content required' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { data: comment, error } = await supabase
    .from('comments')
    .insert({
      stream_id,
      member_id: member.id,
      display_name: display_name || member.display_name || member.name,
      content: content.trim(),
      is_approved: true,
    })
    .select()
    .single()

  if (error || !comment) {
    return NextResponse.json({ error: 'Failed to post' }, { status: 500 })
  }

  return NextResponse.json({ comment })
}
