'use server'

import { redirect } from 'next/navigation'
import { setSession, validateMemberCredentials } from '@/lib/auth'

export async function loginAction(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  if (!email?.trim()) {
    return { error: 'Please enter the email address from your invitation.' }
  }

  if (!password?.trim()) {
    return { error: 'Please enter your access password.' }
  }

  const member = await validateMemberCredentials(email, password)
  if (!member) {
    return { error: 'Invalid email or password. Please check your invitation email.' }
  }

  await setSession(member.id)
  redirect('/watch?welcome=1')
}
