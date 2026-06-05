import type { SetlistCategory } from '@/lib/database.types'

/**
 * Display metadata for each arrangement category. `label` is what the badge
 * reads; `className` is the badge's colour treatment (kept subtle to sit on the
 * dark glass programme without shouting).
 */
export const CATEGORY_META: Record<
  SetlistCategory,
  { label: string; short: string; className: string }
> = {
  solo: {
    label: 'Piano Solo',
    short: 'Solo',
    className: 'border-white/15 bg-white/5 text-foreground/70',
  },
  edm: {
    label: 'EDM',
    short: 'EDM',
    className: 'border-[oklch(0.7_0.18_310/0.4)] bg-[oklch(0.7_0.18_310/0.12)] text-[oklch(0.82_0.14_310)]',
  },
  trio: {
    label: 'Piano Trio',
    short: 'Trio',
    className: 'border-[oklch(0.7_0.13_230/0.4)] bg-[oklch(0.7_0.13_230/0.12)] text-[oklch(0.82_0.11_230)]',
  },
  duet: {
    label: 'Piano Duet',
    short: 'Duet',
    className: 'border-[oklch(0.75_0.15_150/0.4)] bg-[oklch(0.75_0.15_150/0.12)] text-[oklch(0.84_0.12_150)]',
  },
}
