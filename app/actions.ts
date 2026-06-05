'use server'

import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { setSession, validateMemberCredentials } from '@/lib/auth'
import { recordLoginEvent } from '@/lib/tracking'
import { createServiceClient } from '@/lib/supabase-server'

export async function loginAction(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  if (!email?.trim()) {
    return { error: 'Please enter the email address from your invitation.' }
  }

  if (!password?.trim()) {
    return { error: 'Please enter your access password.' }
  }

  const userAgent = (await headers()).get('user-agent')
  const member = await validateMemberCredentials(email, password)

  if (!member) {
    // Distinguish the failure reason for /logs (no_member vs banned vs bad_password).
    let reason: 'no_member' | 'banned' | 'bad_password' = 'bad_password'
    try {
      const supabase = createServiceClient()
      const { data } = await supabase
        .from('members')
        .select('is_banned')
        .eq('email', email.trim().toLowerCase())
        .maybeSingle()
      if (!data) reason = 'no_member'
      else if (data.is_banned) reason = 'banned'
    } catch {
      // leave reason as bad_password
    }
    await recordLoginEvent({ email, success: false, reason, userAgent })
    return { error: 'Invalid email or password. Please check your invitation email.' }
  }

  await recordLoginEvent({ email, memberId: member.id, success: true, reason: 'ok', userAgent })
  await setSession(member.id)
  redirect('/watch?welcome=1')
}
