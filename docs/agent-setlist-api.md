# Setlist API: instructions for your agent

> This is the deep-dive on the setlist endpoints. For the agent's full
> capabilities (members, moderators, chat moderation, stream control, YouTube
> links, tips, broadcasts), see [agent-api.md](agent-api.md).

Copy-paste this whole file into your agent. It tells the agent how to read and
edit the two setlist documents that drive the site.

You can always fetch the live version of these instructions by calling
`GET /api/agent/setlist` (they come back in the `instructions` field), and any
validation error response includes them too.

---

## What you can edit

| slug | Powers | Shape of `data` |
| --- | --- | --- |
| `programme` | The viewer programme on **/watch** | A non-empty array of pieces (`SetlistItem[]`) |
| `belgium-tracker` | The full production tracker on **/setlist** | A single tracker object (`BelgiumTracker`) |

## Auth

Every request needs the agent key:

```
Authorization: Bearer <AGENT_API_KEY>
```

For `PUT` / `PATCH` / `DELETE` bodies, also send `Content-Type: application/json`.
Base URL: `https://vip.musicalbasics.com/api/agent/setlist`

## Operations

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/agent/setlist` | List stored documents + these instructions |
| `GET` | `/api/agent/setlist?slug=<slug>` | Read one document as `{ slug, data }` (404 if none stored, meaning the code default is live) |
| `PUT` | `/api/agent/setlist` | Create or overwrite a document. Body: `{ "slug": "<slug>", "data": <document> }` |
| `PATCH` | `/api/agent/setlist` | Identical to `PUT` |
| `DELETE` | `/api/agent/setlist` | Remove a stored document so the slug reverts to its code default. Body: `{ "slug": "<slug>" }` (or `?slug=`) |

### Important: writes REPLACE, they do not merge

`PUT`/`PATCH` overwrite the entire document for that slug. To make a small
change, **GET the current document, edit the JSON, then PUT the whole thing
back.** If you PUT a partial document you will lose everything you left out.

### How the site picks what to show

- **/watch programme:** the live stream's own `streams.setlist` (if set) wins;
  otherwise the stored `programme` document; otherwise the code default.
- **/setlist tracker:** the stored `belgium-tracker` document; otherwise the
  code default.
- `DELETE` reverts a slug to its code default.

---

## Schema: `programme` (slug `programme`)

`data` is an array of `SetlistItem`. Order in the array is the running order.

```jsonc
[
  {
    "id": "1",                       // required, stable unique id, e.g. "1", "4n", "e2"
    "piece": "Prelude in G minor, Op. 23 No. 5",  // required
    "composer": "Sergei Rachmaninoff",            // required
    "composerYears": "1873-1943",    // optional
    "performer": "Lionel Yu",        // required, e.g. "Lionel Yu, with violin & cello (trio)"
    "duration": "~4 min",            // optional
    "notes": "Opener. Solo piano.",  // optional
    "category": "solo"               // optional: "solo" | "edm" | "trio" | "duet"
  }
]
```

`category` controls the badge on /watch:

- `solo` -> "Piano Solo"
- `edm` -> "EDM" (solo piano with an electronic backing track)
- `trio` -> "Piano Trio" (violin + cello)
- `duet` -> "Piano Duet" (violin + piano)

`data` for `programme` must be a non-empty array, or the write is rejected.

---

## Schema: `belgium-tracker` (slug `belgium-tracker`)

`data` is one object. Send the whole object on every write.

```jsonc
{
  "header": {
    "title": "Belgium Concert",
    "tracker": "Belgium Concert Tracker",
    "when": "Thu 11 Jun 2026, 19u30",
    "venue": "Theaterzaal Maupertuis, CC De Factorij, Zaventem"
  },
  "mainProgram": [ /* SetlistRow[] */ ],
  "mainMusicTotalMin": 58,
  "encores": [ /* SetlistRow[] */ ],
  "benchHeading": "Bench / Candidates (...)",
  "bench": [ /* SetlistRow[] */ ],
  "timing": {
    "title": "Run-time model (...)",
    "target": "Target ceiling: 75 min total (...)",
    "columns": ["Component", "Low (min)", "High (min)", "Notes"],
    "rows": [ /* TimingRow[] */ ],
    "mainTotal": { /* TimingRow */ },
    "encoreRows": [ /* TimingRow[] */ ],
    "fullTotal": { /* TimingRow */ },
    "verdict": ["line 1", "line 2"]
  },
  "colorKey": [ { "key": "Yellow", "meaning": "Decision needed ..." } ],
  "workflow": [ { "step": "Step 1", "detail": "Lock categorization ..." } ],
  "openDecisions": [ { "topic": "Slot length", "detail": "Confirm with Luc ..." } ]
}
```

`SetlistRow` (one row of a tracker table):

```jsonc
{
  "num": "1",                    // "1", "E1", "B2"
  "piece": "Rachmaninoff Prelude in G minor",
  "soloEnsemble": "Solo",        // "Solo" | "Ensemble" | "Solo (+backing)" | "Duet (vln+pno)" | "TBD"
  "edm": "No",                   // "Yes" | "No" | "TBD"
  "runtime": "4",                // minutes, e.g. "4", "4.5", "3.5-4.5"
  "clickToLuc": "n/a",           // "n/a" | "TBD" | "Sent (done)" | "Not needed"
  "lighting": "TBD",
  "video": "TBD",
  "notes": "Opener. Op.23 No.5."
}
```

`TimingRow`:

```jsonc
{ "component": "Talking", "low": "15", "high": "15", "notes": "Your stated 15 min" }
```

Tip: the easiest way to learn the exact current shape is
`GET /api/agent/setlist?slug=belgium-tracker`, then edit and PUT it back.

---

## Examples

List everything (and read the instructions):

```bash
curl -H "Authorization: Bearer $AGENT_API_KEY" \
  https://vip.musicalbasics.com/api/agent/setlist
```

Read the current programme:

```bash
curl -H "Authorization: Bearer $AGENT_API_KEY" \
  "https://vip.musicalbasics.com/api/agent/setlist?slug=programme"
```

Overwrite the programme (full replace):

```bash
curl -X PUT https://vip.musicalbasics.com/api/agent/setlist \
  -H "Authorization: Bearer $AGENT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "slug": "programme",
    "data": [
      {
        "id": "1",
        "piece": "Prelude in G minor, Op. 23 No. 5",
        "composer": "Sergei Rachmaninoff",
        "composerYears": "1873-1943",
        "performer": "Lionel Yu",
        "duration": "~4 min",
        "notes": "Opener. Solo piano.",
        "category": "solo"
      }
    ]
  }'
```

Revert the programme to the code default:

```bash
curl -X DELETE https://vip.musicalbasics.com/api/agent/setlist \
  -H "Authorization: Bearer $AGENT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{ "slug": "programme" }'
```

---

## One-time setup (host)

The data lives in the `vip_livestream.setlists` table. Run the SQL in
`supabase/schema.sql` once in the Supabase SQL editor to create it. Until then
both pages serve the code defaults and writes will fail.
