export const DEFAULT_MEMBER_BADGE = 'vip_member'

export const MEMBER_BADGES = [
  {
    id: 'vip_member',
    label: 'VIP Member',
    emoji: '💛',
    className: 'border-[oklch(0.75_0.12_85)/35] text-[oklch(0.78_0.13_85)] bg-[oklch(0.75_0.12_85)/10]',
  },
  {
    id: 'private_student',
    label: 'Private Student',
    emoji: '🎹',
    className: 'border-[oklch(0.68_0.14_160)/35] text-[oklch(0.76_0.12_160)] bg-[oklch(0.68_0.14_160)/10]',
  },
  {
    id: 'dreamplay_buyer',
    label: 'DreamPlay Buyer',
    emoji: '✨',
    className: 'border-[oklch(0.70_0.15_300)/35] text-[oklch(0.78_0.13_300)] bg-[oklch(0.70_0.15_300)/10]',
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
