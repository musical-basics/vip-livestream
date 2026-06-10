/**
 * Canonical concert details — the single source of truth for the Belgium
 * Concert livestream. Imported by both server code (emails, cron reminders) and
 * client components (announcement dialog). Keep this file free of Node-only
 * imports so it stays safe to bundle for the browser.
 *
 * The concert starts Thursday 11 June 2026 at 19:30 CEST (UTC+2) = 17:30 UTC.
 */
export const CONCERT = {
  name: 'Belgium Concert',
  dateLine: 'Thursday 11 June 2026',
  /** Doors/stream start, in UTC. 19:30 CEST = 17:30 UTC. */
  startUtc: '2026-06-11T17:30:00.000Z',
  /** Human label in the concert's own timezone. */
  startLabelCest: 'Thursday, June 11th, 2026 at 7:30 PM CEST',
} as const

/** Start time as a Date. */
export function concertStart(): Date {
  return new Date(CONCERT.startUtc)
}
