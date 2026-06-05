# Handoff note (2026-06-05)

Status of the VIP livestream app for the Belgium Concert (Thu 11 Jun 2026).
Everything below is committed and pushed to `main` (which auto-deploys to Vercel).

---

## 1. Action required (do these or features stay dark)

### Run the remaining Supabase migrations (SQL editor)
Production DB state, probed 2026-06-05:

| Object | State | Needed by |
| --- | --- | --- |
| `members.is_admin` | present | roles (done) |
| `login_events` table | present | /logs (done) |
| `email_opens` table | present | /analytics (done) |
| `streams.backup_youtube_video_id_1/2` | present | backup sources (done) |
| `chat_messages.reactions`, `streams.pinned_message` | present | chat (done) |
| **`setlists` table** | **MISSING** | editing programme/tracker via API |
| **`members.name_color`** | **MISSING** | custom chat name color |
| **`streams.slow_mode_delay`** | **MISSING** | chat slow mode |

- `setlists`: create it from the section in `supabase/schema.sql` (table + RLS policy). Until then `/setlist` and the `/watch` programme still work (they fall back to the code defaults in `lib/belgium-setlist.ts` / `lib/default-setlist.ts`), but the agent setlist API writes fail.
- `members.name_color` and `streams.slow_mode_delay` belong to the parallel agent's features (custom name colors, slow mode). Run their ALTERs (`supabase/migrate-name-color.sql`; slow_mode is in `supabase/schema.sql`). Leaderboard migrations (`migrate-leaderboard*.sql`, `migrate-all-time-leaderboard.sql`, `migrate-chat-performance.sql`) are also the parallel agent's - verify their run state.

Re-running full `schema.sql` is NOT safe (the `CREATE POLICY` lines error if the policy already exists). Run only the missing `CREATE TABLE` / `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` statements.

### Set Vercel env var
- `RESEND_API_KEY` must be added to the Vercel project env (it currently only lives in `.env.local`). Without it, `POST /api/agent/email-credentials` returns 500 in production. `EMAIL_FROM` is optional (defaults to `Lionel Yu <lionel@musicalbasics.com>`, domain already verified).

---

## 2. Shipped this session

- **Setlist:** `/setlist` page (full Belgium tracker from `Belgium_Concert_Setlist.xlsx`); arrangement category badges (Piano Solo / EDM / Piano Trio / Piano Duet) on the `/watch` programme.
- **Setlist editable via agent API:** `POST/PUT/DELETE /api/agent/setlist` (slugs `programme`, `belgium-tracker`), falling back to code defaults. Needs the `setlists` table.
- **Two-tier roles:** `is_admin` (full access, can assign mods) vs `is_moderator` (chat moderation only). Gates on `/admin`, `/setlist`, `/recordings` detail, `/logs`, `/analytics`, and the `/api/admin/*` + `/api/mod/*` routes via `lib/roles.ts`. Chat name colors + ADMIN/MOD badges reflect role.
  - Current roles: admins = Test Viewer, Lionel; mods = Patricia Louise Everett, Angena Laschka, Naomi Beharry; everyone else regular.
- **Mobile watch layout:** pinned video + Chat/Programme tab switcher (desktop unchanged).
- **Password rotation DISABLED everywhere** (per request): `scripts/email-livestream-credentials.mjs` refuses `--rotate`/`--no-send`; agent `PATCH /api/agent/members` `regenerate_token` no longer rotates (returns existing creds). To fix a "password doesn't work" report, resend the existing credential.
- **Agent can email credentials on demand:** `POST /api/agent/email-credentials` `{ member_id | email | emails[] }` (reuses stored password, max 25).
- **Login logging + email open tracking:** every login attempt -> `login_events`; 1x1 pixel `/api/track/open?m=<id>` embedded in the credential email -> `email_opens`.
- **/logs** (admin): recent attempts, success/fail counts, "trouble signing in" list.
- **/analytics** (admin): email-open rate, login rate, participation rate, per-member table. Participation = logged in OR sent a chat message.
- Admin-only Logs/Analytics links in both the `/admin` page and the `/watch` header.
- Composer credits reworded from "after X" to "X, arr. Lionel Yu" for the four arrangements.
- One-off: re-emailed Angena Laschka a working password (`zfogyh`, now her DB value).

---

## 3. Agent (Openclaw Commander) integration

- Full instructions: `docs/agent-api.md` (everything) and `docs/agent-setlist-api.md` (setlist schemas). The live API also self-describes: `GET /api/agent` and `GET /api/agent/setlist`.
- The agent API has **no email capability except** `POST /api/agent/email-credentials`. The agent should NOT use `regenerate_token` to "fix" logins (it no longer rotates anyway); it should resend credentials via that endpoint.

---

## 4. Known issues / caveats

- **Parallel agent on shared tree:** another agent has been editing the same working tree and auto-committing every few minutes. Several of this session's changes were folded into its commits. If a change looks reverted (especially `components/watch/WatchPageClient.tsx`), it may have been clobbered - re-check. For isolated work, pause that agent or use a separate git worktree.
- **Email opens:** Gmail/others proxy and cache images, so opens register via the proxy and repeat opens undercount. Treat as "opened at least once." Only emails sent AFTER this deploy carry the pixel.
- Removed an untracked `_backup_files/` directory that was breaking `tsc` (stale copies); originals are in git history.

---

## 5. Where things live

- Roles + badge colors + name color: `lib/roles.ts`, `lib/member-badges.ts`
- Setlist data/defaults: `lib/default-setlist.ts`, `lib/belgium-setlist.ts`; store: `lib/setlist-store.ts`
- Email: `lib/livestream-email.ts` (API) and `scripts/email-livestream-credentials.mjs` (bulk/CLI) - keep templates in sync
- Tracking rollups: `lib/tracking.ts`
- Agent API: `app/api/agent/*`; admin API: `app/api/admin/*`; chat mod: `app/api/mod/*`
- Pages: `app/watch`, `app/admin`, `app/setlist`, `app/recordings`, `app/logs`, `app/analytics`
- Migrations: `supabase/*.sql`
