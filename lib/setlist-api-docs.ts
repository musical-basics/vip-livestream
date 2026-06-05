/**
 * Single source of truth for the /api/agent/setlist instructions.
 *
 * This object is returned inside the endpoint's own responses (so an agent can
 * discover how to use it by calling it) and is mirrored, in prose, by
 * docs/agent-setlist-api.md (the copy-paste brief for an external agent).
 * Keep the two in sync when editing.
 */
export const SETLIST_API_DOCS = {
  endpoint: '/api/agent/setlist',
  summary:
    'Read and edit the named setlist documents that power the site: the viewer programme on /watch and the full Belgium production tracker on /setlist.',
  auth: "Send 'Authorization: Bearer <AGENT_API_KEY>' on every request. Without it you get 401.",
  content_type: "Use 'Content-Type: application/json' for PUT/PATCH/DELETE bodies.",
  slugs: {
    programme:
      "The viewer-facing programme shown on /watch. data is a non-empty array of setlist items (SetlistItem[]).",
    'belgium-tracker':
      'The full internal production tracker shown on /setlist (running order, EDM/ensemble flags, runtimes, timing model, workflow, open decisions). data is a single tracker object.',
  },
  resolution_order: {
    'watch programme': [
      "1. the live stream's own streams.setlist, if set (edit via PATCH /api/agent/stream)",
      "2. the stored 'programme' document from this endpoint, if present",
      '3. the built-in code default',
    ],
    'belgium tracker': [
      "1. the stored 'belgium-tracker' document from this endpoint, if present",
      '2. the built-in code default',
    ],
    note: 'A DELETE removes the stored document, so the slug reverts to the code default. Writing an empty/invalid document is rejected rather than silently falling back.',
  },
  operations: [
    {
      method: 'GET',
      path: '/api/agent/setlist',
      description: 'List every stored document plus these instructions.',
    },
    {
      method: 'GET',
      path: '/api/agent/setlist?slug=<slug>',
      description:
        'Return one stored document as { slug, data }. 404 if nothing is stored for that slug (the code default is in use).',
    },
    {
      method: 'PUT',
      path: '/api/agent/setlist',
      body: { slug: '<slug>', data: '<document>' },
      description:
        'Create or overwrite the whole document for a slug. This is a full replace, not a merge: send the complete document every time. PATCH behaves identically.',
    },
    {
      method: 'DELETE',
      path: '/api/agent/setlist',
      body: { slug: '<slug>' },
      description: 'Delete the stored document so the slug reverts to its code default. ?slug= also works.',
    },
  ],
  schemas: {
    SetlistItem: {
      _comment: "One piece in the 'programme' array.",
      id: 'string, required. Stable unique id within the list, e.g. "1", "4n", "e2".',
      piece: 'string, required. Title of the piece.',
      composer: 'string, required. Composer or arranger.',
      composerYears: 'string, optional. e.g. "1810-1849".',
      performer: 'string, required. e.g. "Lionel Yu" or "Lionel Yu, with violin & cello (trio)".',
      duration: 'string, optional. e.g. "~5 min".',
      notes: 'string, optional. Short programme note.',
      category: "string, optional. One of 'solo' | 'edm' | 'trio' | 'duet'. Drives the badge on /watch.",
    },
    BelgiumTracker: {
      _comment: "The 'belgium-tracker' document. Send the full object on every write.",
      header: { title: 'string', tracker: 'string', when: 'string', venue: 'string' },
      mainProgram: 'SetlistRow[]',
      mainMusicTotalMin: 'number',
      encores: 'SetlistRow[]',
      benchHeading: 'string',
      bench: 'SetlistRow[]',
      timing: {
        title: 'string',
        target: 'string',
        columns: 'string[]',
        rows: 'TimingRow[]',
        mainTotal: 'TimingRow',
        encoreRows: 'TimingRow[]',
        fullTotal: 'TimingRow',
        verdict: 'string[]',
      },
      colorKey: '{ key: string, meaning: string }[]',
      workflow: '{ step: string, detail: string }[]',
      openDecisions: '{ topic: string, detail: string }[]',
    },
    SetlistRow: {
      _comment: 'One row of a tracker table (main program, encores, or bench).',
      num: 'string, e.g. "1", "E1", "B2".',
      piece: 'string.',
      soloEnsemble: 'string, e.g. "Solo", "Ensemble", "Solo (+backing)", "Duet (vln+pno)", "TBD".',
      edm: 'string, e.g. "Yes", "No", "TBD".',
      runtime: 'string, minutes, e.g. "4", "4.5", "3.5-4.5".',
      clickToLuc: 'string, e.g. "n/a", "TBD", "Sent (done)", "Not needed".',
      lighting: 'string, e.g. "TBD".',
      video: 'string, e.g. "TBD".',
      notes: 'string.',
    },
    TimingRow: {
      component: 'string.',
      low: 'string, minutes.',
      high: 'string, minutes.',
      notes: 'string.',
    },
  },
  workflow_tip:
    'To edit safely: GET the current document, modify the JSON, then PUT the whole thing back. Always send the complete document because writes replace, not merge.',
  examples: {
    list: 'curl -H "Authorization: Bearer $AGENT_API_KEY" https://vip.musicalbasics.com/api/agent/setlist',
    get_one:
      'curl -H "Authorization: Bearer $AGENT_API_KEY" "https://vip.musicalbasics.com/api/agent/setlist?slug=programme"',
    update_programme:
      'curl -X PUT https://vip.musicalbasics.com/api/agent/setlist -H "Authorization: Bearer $AGENT_API_KEY" -H "Content-Type: application/json" -d \'{"slug":"programme","data":[{"id":"1","piece":"Prelude in G minor, Op. 23 No. 5","composer":"Sergei Rachmaninoff","composerYears":"1873-1943","performer":"Lionel Yu","duration":"~4 min","notes":"Opener. Solo piano.","category":"solo"}]}\'',
    revert: 'curl -X DELETE https://vip.musicalbasics.com/api/agent/setlist -H "Authorization: Bearer $AGENT_API_KEY" -H "Content-Type: application/json" -d \'{"slug":"programme"}\'',
  },
} as const
