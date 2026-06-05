# Bug Fix: YouTube Metadata Rate Limiting and Watch Page Reload Loop

## Bug Description
During a live performance, viewers on `/watch` were experiencing constant video player drops, audio static noise, and were forced to repeatedly reload the page. 

## Cause
1. **Outbound API Rate Limiting:** The server-side components and the client-side polling endpoint `/api/stream/sync` fetched YouTube HTML scraper data on every single request without caching (`cache: 'no-store'`). Under heavy visitor load, YouTube rate-limited or blocked the server's IP, causing outbound fetch calls to hang or return `unknown` statuses.
2. **Page Revalidation Loop:**
   - When a scrape failed, `getVerifiedLiveStream` returned `null` instead of the active stream.
   - The polling sync endpoint `/api/stream/sync` therefore returned `is_live: false` to the client.
   - The client detected the mismatch between its current state (`is_live: true`) and the sync payload (`is_live: false`), classifying it as an `activeStreamEnded` event, and invoked `router.refresh()`.
   - The server re-rendered the Server Component `/watch` but fell back to the database-driven stream (where `is_live` was still `true`).
   - The page re-rendered the player (resetting the iframe and interrupting playback), and 10 seconds later, repeated this loop.

## Solution

### 1. Fetch Timeout and Cache Revalidation
- Implemented a 3-second abort signal (`AbortController`) inside `fetchYouTubeVideoMetadata` to guarantee that slow or blocked YouTube responses will never hang the Vercel serverless function or cause 504 gateway timeouts.
- Configured Next.js fetch caching (`revalidate: 30`) on the metadata fetch in `lib/live-stream.ts`. Subsequent requests are served instantly from the cache while revalidation happens in the background.

### 2. Database State Trust (Architectural Fix)
- Refactored `getVerifiedLiveStream` in `lib/live-stream.ts` to treat the stream as active when its YouTube status is `'live'`, `'waiting'`, or `'unknown'`.
- The database is updated to offline **only** when the YouTube check explicitly confirms the stream has `'ended'`.
- If YouTube blocks scraping (status `'unknown'`), the system defaults to trusting the database state (`is_live: true` in the DB), preventing false-offline status delivery and halting the reload loops.

### 3. Hard Refresh on Video Link Update
- Changed the client-side `refreshWatchPage` in `components/watch/WatchPageClient.tsx` to execute a full window reload (`window.location.reload()`) rather than a Next.js soft data update (`router.refresh()`).
- Soft refreshes leave the old YouTube player iframe in the DOM which can lead to player state corruption, playback drops, and static noise when a new video link is set. A clean page reload completely clears out stale YouTube Player instances and reinitializes the player with the new video ID reliably.
