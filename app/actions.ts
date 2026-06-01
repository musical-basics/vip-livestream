'use server'

import { redirect } from 'next/navigation'
import { validatePasswordToken } from '@/lib/auth'
import { setSession } from '@/lib/auth'

export async function loginAction(formData: FormData) {
  const password = formData.get('password') as string
  if (!password?.trim()) {
    return { error: 'Please enter your access password.' }
  }

  const member = await validatePasswordToken(password.trim())
  if (!member) {
    return { error: 'Invalid password. Please check your invitation email.' }
  }

  await setSession(member.id)
  redirect('/watch')
}

export async function autoLoginAction(token: string) {
  const member = await validatePasswordToken(token)
  if (!member) return null

  await setSession(member.id)
  return member
}
