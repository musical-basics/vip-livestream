import type { Member } from '@/lib/database.types'

/**
 * Two-tier roles:
 *  - admin (is_admin): full access. Manages streams, members, the setlist, and
 *    can assign moderators. An admin can also do everything a mod can.
 *  - moderator (is_moderator): chat moderation only (mute/delete messages,
 *    timeout members). No admin panel, recordings, or setlist access.
 *  - regular member: neither flag.
 *
 * These accept the relevant fields so they also work on partial member objects
 * (e.g. a chat sender) and tolerate the flags being absent before the is_admin
 * column has been migrated (treated as false).
 */
type RoleFlags = Partial<Pick<Member, 'is_admin' | 'is_moderator'>>

/** Full admin: the only role that can manage the platform and assign mods. */
export function isAdmin(member: RoleFlags | null | undefined): boolean {
  return !!member?.is_admin
}

/** Can perform chat moderation. Admins can moderate chat too. */
export function canModerateChat(member: RoleFlags | null | undefined): boolean {
  return !!member?.is_admin || !!member?.is_moderator
}

/** Short role label for badges/UI. */
export function roleLabel(member: RoleFlags | null | undefined): 'ADMIN' | 'MOD' | null {
  if (isAdmin(member)) return 'ADMIN'
  if (member?.is_moderator) return 'MOD'
  return null
}
