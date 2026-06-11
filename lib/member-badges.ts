export const DEFAULT_MEMBER_BADGE = 'vip_member'

export const MEMBER_BADGES = [
  {
    id: 'vip_member',
    label: 'VIP Member',
    emoji: '💛',
    // `color` is the standalone display colour (used for chat names); className is the badge pill.
    color: 'oklch(0.85 0.16 90)',
    className: 'border-[oklch(0.82_0.16_90)/50] text-[oklch(0.85_0.16_90)] bg-[oklch(0.82_0.16_90)/15]',
  },
  {
    id: 'private_student',
    label: 'Private Student',
    emoji: '🎹',
    color: 'oklch(0.80 0.16 165)',
    className: 'border-[oklch(0.76_0.17_165)/50] text-[oklch(0.80_0.16_165)] bg-[oklch(0.76_0.17_165)/15]',
  },
] as const

export type MemberBadgeId = (typeof MEMBER_BADGES)[number]['id']

const MEMBER_BADGE_IDS = new Set<string>(MEMBER_BADGES.map((badge) => badge.id))

export function getMemberBadge(id: string) {
  return MEMBER_BADGES.find((badge) => badge.id === id)
}

export function normalizeMemberBadges(value: unknown): MemberBadgeId[] {
  if (!Array.isArray(value)) return [DEFAULT_MEMBER_BADGE]

  const normalized = value
    .filter((badge): badge is string => typeof badge === 'string')
    .map((badge) => badge.trim().toLowerCase())
    .filter((badge, index, badges) => MEMBER_BADGE_IDS.has(badge) && badges.indexOf(badge) === index) as MemberBadgeId[]

  return normalized.length > 0 ? normalized : [DEFAULT_MEMBER_BADGE]
}
