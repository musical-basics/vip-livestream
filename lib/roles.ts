import type { Member } from '@/lib/database.types'
import { getMemberBadge, normalizeMemberBadges } from '@/lib/member-badges'

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
export function roleLabel(member: RoleFlags | null | undefined): RoleName | null {
  if (isAdmin(member)) return 'ADMIN'
  if (member?.is_moderator) return 'MOD'
  return null
}

export type RoleName = 'ADMIN' | 'MOD'

/**
 * Display style for each role badge. Distinct, vibrant hues so roles are easy
 * to tell apart at a glance: ADMIN = crimson with a crown, MOD = blue with a
 * shield. Member access badges have their own colours in lib/member-badges.ts.
 */
export const ROLE_BADGE: Record<RoleName, { label: string; emoji: string; color: string; className: string }> = {
  ADMIN: {
    label: 'ADMIN',
    emoji: '👑',
    color: 'oklch(0.78 0.19 25)',
    className: 'border-[oklch(0.7_0.2_25)/55] text-[oklch(0.78_0.19_25)] bg-[oklch(0.7_0.2_25)/15]',
  },
  MOD: {
    label: 'MOD',
    emoji: '🛡️',
    color: 'oklch(0.78 0.15 250)',
    className: 'border-[oklch(0.7_0.16_250)/55] text-[oklch(0.78_0.15_250)] bg-[oklch(0.7_0.16_250)/15]',
  },
}

/** Resolve the role badge for a member, or null for a regular member. */
export function roleBadge(member: RoleFlags | null | undefined) {
  const label = roleLabel(member)
  return label ? ROLE_BADGE[label] : null
}

/**
 * Display colour for a person's chat name. Role wins (admin = crimson,
 * mod = blue); otherwise it matches their primary access badge (VIP gold,
 * private student emerald, DreamPlay violet). So a name always reinforces the
 * badge shown beside it.
 */
export function nameColor(role: RoleName | null, accessBadges: unknown): string {
  if (role) return ROLE_BADGE[role].color
  const primary = getMemberBadge(normalizeMemberBadges(accessBadges)[0])
  return primary?.color ?? 'oklch(0.85 0.16 90)'
}
