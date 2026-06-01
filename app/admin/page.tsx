import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase-server'
import AdminPageClient from '@/components/admin/AdminPageClient'

export default async function AdminPage() {
  const member = await getSession()
  if (!member) redirect('/')
  if (!member.is_moderator) redirect('/watch')

  const supabase = createServiceClient()

  const { data: streams } = await supabase
    .from('streams')
    .select('*')
    .order('created_at', { ascending: false })

  const { data: members } = await supabase
    .from('members')
    .select('id, name, email, display_name, is_moderator, is_banned, created_at')
    .order('name')

  return (
    <AdminPageClient
      currentMember={member}
      streams={streams || []}
      members={members as any || []}
    />
  )
}
