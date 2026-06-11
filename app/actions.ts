'use server'

import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { getSession, setSession, validateMemberCredentials } from '@/lib/auth'
import { recordLoginEvent } from '@/lib/tracking'
import { createServiceClient } from '@/lib/supabase-server'
import { isAdmin } from '@/lib/roles'
import { renderStreamLinksEmail, sendEmail } from '@/lib/livestream-email'

export async function loginAction(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const redirectTo = (formData.get('redirectTo') as string) || '/watch?welcome=1'

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
  redirect(redirectTo)
}

export async function sendStreamLinksAction(streamId: string) {
  const adminMember = await getSession()
  if (!isAdmin(adminMember)) {
    return { error: 'Forbidden' }
  }

  const supabase = createServiceClient()

  // 1. Fetch stream
  const { data: stream, error: streamError } = await supabase
    .from('streams')
    .select('*')
    .eq('id', streamId)
    .single()

  if (streamError || !stream) {
    return { error: 'Stream not found' }
  }

  // 2. Fetch all active, non-banned members
  const { data: members, error: membersError } = await supabase
    .from('members')
    .select('id, name, email, password_token')
    .eq('is_banned', false)

  if (membersError || !members) {
    return { error: 'Failed to fetch members' }
  }

  let sentCount = 0
  let failedCount = 0

  const emailPromises = members.map(async (member) => {
    try {
      const { subject, html, text } = renderStreamLinksEmail({
        name: member.name,
        email: member.email,
        password: member.password_token,
        stream,
      })

      await sendEmail({
        to: member.email,
        subject,
        html,
        text,
      })
      sentCount++
    } catch (err) {
      console.error(`Failed to send email to ${member.email}:`, err)
      failedCount++
    }
  })

  await Promise.all(emailPromises)

  return { success: true, sentCount, failedCount }
}

export async function sendTestStreamLinksAction(streamId: string, testEmail: string) {
  const adminMember = await getSession()
  if (!isAdmin(adminMember)) {
    return { error: 'Forbidden' }
  }

  if (!testEmail?.trim()) {
    return { error: 'Test email address is required' }
  }

  const supabase = createServiceClient()

  // 1. Fetch stream
  const { data: stream, error: streamError } = await supabase
    .from('streams')
    .select('*')
    .eq('id', streamId)
    .single()

  if (streamError || !stream) {
    return { error: 'Stream not found' }
  }

  try {
    const { subject, html, text } = renderStreamLinksEmail({
      name: 'Test Recipient',
      stream,
    })

    await sendEmail({
      to: testEmail.trim(),
      subject,
      html,
      text,
    })

    return { success: true }
  } catch (err) {
    console.error(`Failed to send test email to ${testEmail}:`, err)
    return { error: err instanceof Error ? err.message : 'Failed to send test email' }
  }
}
