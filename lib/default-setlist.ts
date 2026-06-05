import type { SetlistItem } from '@/lib/database.types'

/**
 * Default programme shown for every stream.
 *
 * Right now every stream (including test streams) is the Belgium Concert, so
 * this is the single source of truth: any stream whose `setlist` column is
 * null or empty renders this list. A stream can still override it by setting
 * its own non-empty `setlist` in the DB (admin UI or PATCH /api/agent/stream).
 *
 * Each piece carries a `category` (solo, edm, trio, or duet) so the programme
 * can badge how it is performed. For the full production planning detail, see
 * the Belgium concert tracker on /setlist.
 *
 * Belgium Concert, Theaterzaal Maupertuis, CC De Factorij, Zaventem, 11 June 2026.
 */
export const DEFAULT_SETLIST: SetlistItem[] = [
  {
    id: '1',
    piece: 'Prelude in G minor, Op. 23 No. 5',
    composer: 'Sergei Rachmaninoff',
    composerYears: '1873-1943',
    performer: 'Lionel Yu',
    duration: '~4 min',
    notes: 'Opener. Solo piano.',
    category: 'solo',
  },
  {
    id: '2',
    piece: 'Colors of the Soul',
    composer: 'Lionel Yu',
    performer: 'Lionel Yu',
    duration: '~4 min',
    notes: 'Original work for solo piano.',
    category: 'solo',
  },
  {
    id: '3',
    piece: 'Gallop',
    composer: 'Lionel Yu',
    performer: 'Lionel Yu, with violin & cello (trio)',
    duration: '~5 min',
    notes: 'Trio arrangement.',
    category: 'trio',
  },
  {
    id: '4',
    piece: 'Torrent, Étude Op. 10 No. 4',
    composer: 'Frédéric Chopin',
    composerYears: '1810-1849',
    performer: 'Lionel Yu',
    duration: '~2.5 min',
    notes: 'Solo piano.',
    category: 'solo',
  },
  {
    id: '4n',
    piece: 'Torrent Étude (Nightmare)',
    composer: 'after Frédéric Chopin',
    performer: 'Lionel Yu',
    duration: '~4 min',
    notes: "'Nightmare' arrangement. Solo piano with electronic backing.",
    category: 'edm',
  },
  {
    id: '5',
    piece: 'Beethoven Virus',
    composer: 'after Ludwig van Beethoven',
    performer: 'Lionel Yu, with violin & cello (trio)',
    duration: '~4.5 min',
    notes: 'Trio arrangement.',
    category: 'trio',
  },
  {
    id: '6',
    piece: 'Canon in Dream',
    composer: 'after Johann Pachelbel',
    composerYears: '1653-1706',
    performer: 'Lionel Yu',
    duration: '~4.5 min',
    notes: 'Electronic arrangement. Solo piano with backing track.',
    category: 'edm',
  },
  {
    id: '7',
    piece: 'Fight for Freedom',
    composer: 'Lionel Yu',
    performer: 'Lionel Yu',
    duration: '~5 min',
    notes: 'Original work for solo piano.',
    category: 'solo',
  },
  {
    id: '8',
    piece: 'Winter Wind, Étude Op. 25 No. 11',
    composer: 'Frédéric Chopin',
    composerYears: '1810-1849',
    performer: 'Lionel Yu',
    duration: '~4 min',
    notes: 'Solo piano.',
    category: 'solo',
  },
  {
    id: '9',
    piece: 'Moonlight Sonata',
    composer: 'Ludwig van Beethoven',
    composerYears: '1770-1827',
    performer: 'Lionel Yu',
    duration: '~6 min',
    notes: "'Nightmare' arrangement. Solo piano with electronic backing.",
    category: 'edm',
  },
  {
    id: '10',
    piece: 'Sunflowers',
    composer: 'Lionel Yu',
    performer: 'Lionel Yu',
    duration: '~5 min',
    notes: 'Original work for solo piano.',
    category: 'solo',
  },
  {
    id: '11',
    piece: 'Dreams of a Violin',
    composer: 'Lionel Yu',
    performer: 'Lionel Yu, with violin (duet)',
    duration: '~5 min',
    notes: 'Violin and piano duet.',
    category: 'duet',
  },
  {
    id: '12',
    piece: 'Für Elise',
    composer: 'Ludwig van Beethoven',
    composerYears: '1770-1827',
    performer: 'Lionel Yu',
    duration: '~5 min',
    notes: 'Dubstep arrangement. Solo piano with electronic backing.',
    category: 'edm',
  },
  {
    id: 'e1',
    piece: 'Fantaisie-Impromptu',
    composer: 'Frédéric Chopin',
    composerYears: '1810-1849',
    performer: 'Lionel Yu',
    duration: '~5 min',
    notes: 'Encore. Op. 66, solo piano.',
    category: 'solo',
  },
  {
    id: 'e2',
    piece: 'Flight of the Bumblebee',
    composer: 'Nikolai Rimsky-Korsakov',
    composerYears: '1844-1908',
    performer: 'Lionel Yu',
    duration: '~2 min',
    notes: 'Encore. Solo piano.',
    category: 'solo',
  },
  {
    id: 'e3',
    piece: 'Still D.R.E.',
    composer: 'after Dr. Dre',
    performer: 'Lionel Yu',
    duration: '~3.5 min',
    notes: 'Encore. Electronic arrangement. Solo piano with backing track.',
    category: 'edm',
  },
]
