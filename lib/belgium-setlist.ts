/**
 * Full Belgium concert planning detail, transcribed verbatim from
 * Belgium_Concert_Setlist.xlsx (sheets: Setlist, Timing, Key & Workflow).
 *
 * This is the internal production tracker (running order, EDM/ensemble
 * categorisation, runtimes, click-track status, lighting/video, open
 * decisions). It powers /setlist. The viewer-facing programme lives in
 * lib/default-setlist.ts.
 *
 * `DEFAULT_BELGIUM_TRACKER` is the code fallback. The live tracker can be
 * edited via the agent API and is stored as one JSON document in
 * vip_livestream.setlists (slug 'belgium-tracker'); see lib/setlist-store.ts.
 *
 * Belgium Concert: Thu 11 Jun 2026, 19u30, Theaterzaal Maupertuis,
 * CC De Factorij, Zaventem.
 */

export interface SetlistRow {
  num: string
  piece: string
  soloEnsemble: string
  edm: string
  runtime: string
  clickToLuc: string
  lighting: string
  video: string
  notes: string
}

export interface TimingRow {
  component: string
  low: string
  high: string
  notes: string
}

export interface BelgiumTracker {
  header: {
    title: string
    tracker: string
    when: string
    venue: string
  }
  mainProgram: SetlistRow[]
  /** Music total for all listed main-program pieces (sheet formula SUM(E3:E14)). */
  mainMusicTotalMin: number
  encores: SetlistRow[]
  benchHeading: string
  bench: SetlistRow[]
  timing: {
    title: string
    target: string
    columns: string[]
    rows: TimingRow[]
    mainTotal: TimingRow
    encoreRows: TimingRow[]
    fullTotal: TimingRow
    verdict: string[]
  }
  colorKey: { key: string; meaning: string }[]
  workflow: { step: string; detail: string }[]
  openDecisions: { topic: string; detail: string }[]
}

/** Column headers for the setlist tables (presentation; not stored). */
export const SETLIST_COLUMNS = [
  '#',
  'Piece',
  'Solo / Ensemble',
  'EDM (backing+click)',
  'Runtime (min)',
  'Click to Luc',
  'Lighting',
  'Video',
  'Status / Notes',
] as const

export const DEFAULT_BELGIUM_TRACKER: BelgiumTracker = {
  header: {
    title: 'Belgium Concert',
    tracker: 'Belgium Concert Tracker',
    when: 'Thu 11 Jun 2026, 19u30',
    venue: 'Theaterzaal Maupertuis, CC De Factorij, Zaventem',
  },
  mainMusicTotalMin: 58,
  mainProgram: [
    {
      num: '1',
      piece: 'Rachmaninoff Prelude in G minor',
      soloEnsemble: 'Solo',
      edm: 'No',
      runtime: '4',
      clickToLuc: 'n/a',
      lighting: 'TBD',
      video: 'TBD',
      notes: 'Opener. Op.23 No.5. (Venue page wrongly says C# min - confirmed G min.)',
    },
    {
      num: '2',
      piece: 'Colors of the Soul',
      soloEnsemble: 'Solo',
      edm: 'No',
      runtime: '4',
      clickToLuc: 'n/a',
      lighting: 'TBD',
      video: 'TBD',
      notes: 'Solo piano.',
    },
    {
      num: '3',
      piece: 'Gallop (trio)',
      soloEnsemble: 'Ensemble',
      edm: 'TBD',
      runtime: '5',
      clickToLuc: 'Sent (done)',
      lighting: 'TBD',
      video: 'TBD',
      notes: "Marked 'trio'. Confirm if EDM. Backing track sent to instrumentalists.",
    },
    {
      num: '4',
      piece: 'La Campanella (EDM)',
      soloEnsemble: 'Solo (+backing)',
      edm: 'Yes',
      runtime: '6',
      clickToLuc: 'TBD',
      lighting: 'TBD',
      video: 'TBD',
      notes: "'Nightmare' arr. Solo piano + backing track (confirmed).",
    },
    {
      num: '5',
      piece: 'Beethoven Virus (trio)',
      soloEnsemble: 'Ensemble',
      edm: 'TBD',
      runtime: '4.5',
      clickToLuc: 'Sent (done)',
      lighting: 'TBD',
      video: 'TBD',
      notes: 'Trio. Often EDM-styled - confirm. Backing track sent to instrumentalists.',
    },
    {
      num: '6',
      piece: 'Canon in Dream',
      soloEnsemble: 'Solo (+backing)',
      edm: 'Yes',
      runtime: '4.5',
      clickToLuc: 'TBD',
      lighting: 'TBD',
      video: 'TBD',
      notes: 'EDM. Solo piano + backing track (confirmed).',
    },
    {
      num: '7',
      piece: 'Fight for Freedom (maybe)',
      soloEnsemble: 'Solo',
      edm: 'No',
      runtime: '5',
      clickToLuc: 'n/a',
      lighting: 'TBD',
      video: 'TBD',
      notes: 'Solo piano.',
    },
    {
      num: '8',
      piece: 'Winter Wind  OR  Fight for Freedom',
      soloEnsemble: 'Solo',
      edm: 'No',
      runtime: '4',
      clickToLuc: 'n/a',
      lighting: 'TBD',
      video: 'TBD',
      notes: 'Solo piano.',
    },
    {
      num: '9',
      piece: 'Moonlight Sonata (EDM)',
      soloEnsemble: 'Solo (+backing)',
      edm: 'Yes',
      runtime: '6',
      clickToLuc: 'TBD',
      lighting: 'TBD',
      video: 'TBD',
      notes: "'Nightmare' arr. Solo piano + backing track (confirmed).",
    },
    {
      num: '10',
      piece: 'Sunflowers',
      soloEnsemble: 'Solo',
      edm: 'No',
      runtime: '5',
      clickToLuc: 'n/a',
      lighting: 'TBD',
      video: 'TBD',
      notes: 'Solo piano.',
    },
    {
      num: '11',
      piece: 'Dreams of a Violin (Duet)',
      soloEnsemble: 'Duet (vln+pno)',
      edm: 'TBD',
      runtime: '5',
      clickToLuc: 'Not needed',
      lighting: 'TBD',
      video: 'TBD',
      notes: 'Violin + piano only (no cello). Confirm if EDM. Confirmed: no practice track required.',
    },
    {
      num: '12',
      piece: 'Fur Elise (dubstep)',
      soloEnsemble: 'Solo (+backing)',
      edm: 'Yes',
      runtime: '5',
      clickToLuc: 'TBD',
      lighting: 'TBD',
      video: 'TBD',
      notes: 'Dubstep=EDM. Solo piano + backing track (confirmed).',
    },
  ],
  encores: [
    {
      num: 'E1',
      piece: 'Fantasie Impromptu (?)',
      soloEnsemble: 'Solo',
      edm: 'No',
      runtime: '5',
      clickToLuc: 'n/a',
      lighting: 'TBD',
      video: 'TBD',
      notes: 'Solo piano.',
    },
    {
      num: 'E2',
      piece: 'Flight of the Bumblebee',
      soloEnsemble: 'Solo',
      edm: 'No',
      runtime: '2',
      clickToLuc: 'n/a',
      lighting: 'TBD',
      video: 'TBD',
      notes: 'Solo piano.',
    },
    {
      num: 'E3',
      piece: 'Still Dre',
      soloEnsemble: 'Solo (+backing)',
      edm: 'Yes',
      runtime: '3.5',
      clickToLuc: 'TBD',
      lighting: 'TBD',
      video: 'TBD',
      notes: 'EDM. Solo piano + backing track (confirmed).',
    },
  ],
  benchHeading:
    'Bench / Candidates (advertised on venue page or alternates - not in running order)',
  bench: [
    {
      num: 'B1',
      piece: 'Torrent Etude Nightmare (Chopin)',
      soloEnsemble: 'TBD',
      edm: 'TBD',
      runtime: '3.5-4.5',
      clickToLuc: 'TBD',
      lighting: 'TBD',
      video: 'TBD',
      notes: 'On venue page, not your list. Candidate.',
    },
    {
      num: 'B2',
      piece: 'Four Seasons Nightmare (Vivaldi)',
      soloEnsemble: 'TBD',
      edm: 'TBD',
      runtime: '3.5-4.5',
      clickToLuc: 'TBD',
      lighting: 'TBD',
      video: 'TBD',
      notes: 'On venue page, not your list. Candidate.',
    },
    {
      num: 'B3',
      piece: 'Rolling Thunder',
      soloEnsemble: 'TBD',
      edm: 'TBD',
      runtime: '3.5-4.5',
      clickToLuc: 'TBD',
      lighting: 'TBD',
      video: 'TBD',
      notes: 'Original, on venue page. Candidate.',
    },
    {
      num: 'B4',
      piece: 'Fires of a Revolution',
      soloEnsemble: 'TBD',
      edm: 'TBD',
      runtime: '3.5-4.5',
      clickToLuc: 'TBD',
      lighting: 'TBD',
      video: 'TBD',
      notes: 'Original, on venue page. Candidate.',
    },
    {
      num: 'B5',
      piece: 'Courage',
      soloEnsemble: 'TBD',
      edm: 'TBD',
      runtime: '3.5-4.5',
      clickToLuc: 'TBD',
      lighting: 'TBD',
      video: 'TBD',
      notes: 'Original, on venue page. Candidate.',
    },
  ],
  timing: {
    title: 'Run-time model (your actual piece runtimes)',
    target:
      'Target ceiling: 75 min total (your stated 60 music + 15 talking). Music fits; full show is tight - see verdict.',
    columns: ['Component', 'Low (min)', 'High (min)', 'Notes'],
    rows: [
      {
        component: 'Main program music (11 pieces, pick-one resolved)',
        low: '53',
        high: '53',
        notes: 'Keeps Winter Wind (4); drops dup Fight for Freedom. =58 if both kept.',
      },
      {
        component: 'Transitions / applause / trio entrances / EDM cueing',
        low: '6',
        high: '11',
        notes: '11 pieces x 0.5-1.0 min - the hidden cost',
      },
      {
        component: 'Talking',
        low: '15',
        high: '15',
        notes: 'Your stated 15 min',
      },
    ],
    mainTotal: {
      component: 'Main show total (no encores)',
      low: '74',
      high: '79',
      notes: 'vs 75 ceiling',
    },
    encoreRows: [
      { component: '+ Flight of the Bumblebee', low: '2', high: '2', notes: '' },
      { component: '+ Still Dre', low: '3.5', high: '3.5', notes: '' },
      { component: '+ encore transitions', low: '1', high: '2', notes: '2 entrances/applause' },
    ],
    fullTotal: {
      component: 'Full show total (main + 2 encores)',
      low: '80',
      high: '86.5',
      notes: 'OVER 75 ceiling',
    },
    verdict: [
      'Music alone (11 pieces) = 53 min - comfortably under 60.',
      'Main show with 15 min talk + transitions = 74-79 min - at/over the 75 ceiling, before encores.',
      'Full show with 2 encores = 80-86 min - needs a 90-min slot, or cuts.',
      'Levers (~5 min each): resolve pick-one; cut talk 15 to 10; or drop one piece per encore.',
      'Confirm the actual slot length with Luc - venue page lists no duration.',
    ],
  },
  colorKey: [
    { key: 'Yellow', meaning: 'Decision needed - confirm before proceeding.' },
    { key: 'Green', meaning: 'Confirmed Yes / has element (e.g., EDM).' },
    {
      key: 'Blue row',
      meaning: 'Ensemble (violin+cello). Needs piano+click and full+click tracks for Luc.',
    },
    {
      key: 'Orange',
      meaning: 'Bench/candidate - advertised on venue page or alternate, not yet in running order.',
    },
    { key: 'Grey italic', meaning: 'Tentative / pick-one.' },
    {
      key: 'Pale green',
      meaning: 'Duet (violin + piano, no cello) - e.g., Dreams of a Violin.',
    },
  ],
  workflow: [
    { step: 'Step 1', detail: 'Lock categorization - resolve all yellow cells (solo/ensemble, EDM).' },
    { step: 'Step 2', detail: 'Confirm 75-min slot with Luc (venue page lists NO duration).' },
    {
      step: 'Step 3',
      detail:
        'For each ENSEMBLE piece: produce piano+click and full+click audios (after you drop source files here).',
    },
    {
      step: 'Step 4',
      detail: 'Send both audios per ensemble piece to Luc, violinist + cellist practice & record along.',
    },
    {
      step: 'Step 5',
      detail: "Set up EDM backing + click on Audient interface + MacBook Pro (the 'Yes' EDM rows).",
    },
    { step: 'Step 6', detail: 'Lighting + video - revisit later.' },
  ],
  openDecisions: [
    {
      topic: 'Slot length',
      detail: 'Confirm with Luc - modeling to 75 min total. Currently on the edge (see Timing).',
    },
    {
      topic: 'Tentative',
      detail: 'Fight for Freedom (maybe); Fantasie Impromptu (encore).',
    },
    { topic: 'Pick-one', detail: 'Winter Wind OR Fight for Freedom.' },
    {
      topic: 'Solo vs trio?',
      detail:
        'Colors of the Soul, Canon in Dream, Sunflowers, La Campanella, Moonlight, Fur Elise, Bumblebee, Still Dre.',
    },
    {
      topic: 'EDM?',
      detail: 'Gallop, Beethoven Virus, Canon in Dream, Dreams of a Violin + above.',
    },
    {
      topic: 'Venue mismatch',
      detail:
        'Venue page lists Torrent Etude, Four Seasons, Rolling Thunder, Fires of a Revolution, Courage (now on Bench tab). It omits Canon in Dream, Sunflowers, Bumblebee, Still Dre.',
    },
  ],
}
