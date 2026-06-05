# VIP Livestream Agent API: instructions for your agent

Copy-paste this whole file into your agent. It can do everything an admin can:
manage members and moderators, moderate chat, control the live stream and its
YouTube link, manage comments and tips, send realtime broadcasts, and edit the
setlists.

The endpoint always describes itself: `GET /api/agent` returns the live
reference, and `GET /api/agent/setlist` returns the setlist instructions. If
anything here ever disagrees with those responses, trust the live response.

---

## Basics

- **Base URL:** `https://vip.musicalbasics.com/api/agent`
- **Auth (every request):** `Authorization: Bearer <AGENT_API_KEY>`
  Missing or wrong key returns `401`.
- **Bodies:** send `Content-Type: application/json` for any `POST`/`PUT`/`PATCH`/`DELETE` with a body.
- **Responses:** success looks like `{ "ok": true, ... }`; failure is `{ "error": "..." }` with a 4xx/5xx status.

### How to find the IDs you need

Most write actions need a `stream_id` or `member_id`. Get them first:

- `GET /api/agent/status` -> the current/most-recent stream (`id`, `title`, `is_live`, `youtube_video_id`, backup YouTube IDs) plus member counts. **Start here.**
- `GET /api/agent/stream` -> every stream, newest first.
- `GET /api/agent/members` -> every member with their `id`, `email`, moderator/ban flags, and login credentials.

---

## Common tasks (recipes)

### Roles: admin vs moderator

There are two independent role flags:

- **`is_admin`** - full access. Manages streams, members, the setlist, and can
  assign moderators. An admin can also do everything a moderator can.
- **`is_moderator`** - chat moderation only (mute/delete messages, timeout
  members). No admin panel, recordings detail, or setlist access.

A regular member has both `false`.

### Make someone a moderator (chat-only) or remove it

```bash
curl -X PATCH https://vip.musicalbasics.com/api/agent/members \
  -H "Authorization: Bearer $AGENT_API_KEY" -H "Content-Type: application/json" \
  -d '{ "member_id": "<uuid>", "is_moderator": true }'
```

### Make someone an admin (full access) or remove it

```bash
curl -X PATCH https://vip.musicalbasics.com/api/agent/members \
  -H "Authorization: Bearer $AGENT_API_KEY" -H "Content-Type: application/json" \
  -d '{ "member_id": "<uuid>", "is_admin": true }'
```

Set the flag to `false` to demote. Find the `member_id` via
`GET /api/agent/members` (filter with `?moderators_only=true` or `?admins_only=true`).

### Moderate chat

Mute (hide) a single message in real time, or unmute it:

```bash
curl -X PATCH https://vip.musicalbasics.com/api/agent/messages \
  -H "Authorization: Bearer $AGENT_API_KEY" -H "Content-Type: application/json" \
  -d '{ "message_id": "<uuid>", "stream_id": "<uuid>", "is_muted": true }'
```

Permanently delete a message:

```bash
curl -X DELETE https://vip.musicalbasics.com/api/agent/messages \
  -H "Authorization: Bearer $AGENT_API_KEY" -H "Content-Type: application/json" \
  -d '{ "message_id": "<uuid>", "stream_id": "<uuid>" }'
```

Time out a member from chat (omit `minutes` or send `null` for a permanent mute):

```bash
curl -X POST https://vip.musicalbasics.com/api/agent/moderation \
  -H "Authorization: Bearer $AGENT_API_KEY" -H "Content-Type: application/json" \
  -d '{ "action": "timeout", "member_id": "<uuid>", "stream_id": "<uuid>", "minutes": 10 }'
```

Lift all timeouts for that member:

```bash
curl -X DELETE https://vip.musicalbasics.com/api/agent/moderation \
  -H "Authorization: Bearer $AGENT_API_KEY" -H "Content-Type: application/json" \
  -d '{ "member_id": "<uuid>", "stream_id": "<uuid>" }'
```

Ban a member from the whole platform (stronger than a chat timeout):

```bash
curl -X PATCH https://vip.musicalbasics.com/api/agent/members \
  -H "Authorization: Bearer $AGENT_API_KEY" -H "Content-Type: application/json" \
  -d '{ "member_id": "<uuid>", "is_banned": true }'
```

### Start, restart, or end the live stream

There is at most one live stream at a time. Setting one live automatically ends
any other live stream and stamps its start time.

Go live / restart an existing stream:

```bash
curl -X PATCH https://vip.musicalbasics.com/api/agent/stream \
  -H "Authorization: Bearer $AGENT_API_KEY" -H "Content-Type: application/json" \
  -d '{ "stream_id": "<uuid>", "is_live": true }'
```

End the stream (viewers see it stop; archived links live on /recordings):

```bash
curl -X PATCH https://vip.musicalbasics.com/api/agent/stream \
  -H "Authorization: Bearer $AGENT_API_KEY" -H "Content-Type: application/json" \
  -d '{ "stream_id": "<uuid>", "is_live": false }'
```

A "restart" is just end then go-live again, or simply `PATCH ... is_live: true`
which re-stamps the start time. To restart fresh on a NEW video, create one:

```bash
curl -X POST https://vip.musicalbasics.com/api/agent/stream \
  -H "Authorization: Bearer $AGENT_API_KEY" -H "Content-Type: application/json" \
  -d '{ "title": "VIP Livestream", "youtube_video_id": "https://youtu.be/MAINID", "backup_youtube_video_id_1": "https://youtu.be/BACKUP1ID", "backup_youtube_video_id_2": "https://youtu.be/BACKUP2ID", "is_live": true }'
```

### Change the YouTube watch link

`youtube_video_id`, `backup_youtube_video_id_1`, and
`backup_youtube_video_id_2` accept a full YouTube URL or a raw video ID.
Updating any of them broadcasts a refresh so connected viewers pick up the new
stream source selector automatically. Send `null` or `""` for a backup field to
clear it.

```bash
curl -X PATCH https://vip.musicalbasics.com/api/agent/stream \
  -H "Authorization: Bearer $AGENT_API_KEY" -H "Content-Type: application/json" \
  -d '{ "stream_id": "<uuid>", "youtube_video_id": "https://youtu.be/MAINID", "backup_youtube_video_id_1": "https://youtu.be/BACKUP1ID", "backup_youtube_video_id_2": null }'
```

### Edit the programme / setlist

See the dedicated brief: [agent-setlist-api.md](agent-setlist-api.md) (or call
`GET /api/agent/setlist`, which returns full instructions). In short:

- `programme` slug -> the /watch programme (array of pieces with solo/edm/trio/duet category)
- `belgium-tracker` slug -> the full /setlist production tracker

```bash
curl -X PUT https://vip.musicalbasics.com/api/agent/setlist \
  -H "Authorization: Bearer $AGENT_API_KEY" -H "Content-Type: application/json" \
  -d '{ "slug": "programme", "data": [ /* SetlistItem[] */ ] }'
```

### Send an announcement / custom realtime event

```bash
curl -X POST https://vip.musicalbasics.com/api/agent/broadcast \
  -H "Authorization: Bearer $AGENT_API_KEY" -H "Content-Type: application/json" \
  -d '{ "stream_id": "<uuid>", "event": "announcement", "payload": { "text": "Starting in 5 minutes" } }'
```

---

## Full endpoint reference

All paths are under `https://vip.musicalbasics.com/api/agent`.

### Status

| Method | Path | Body / Query | Notes |
| --- | --- | --- | --- |
| GET | `/status` | - | Current (or most recent) stream + member counts + total messages. |

### Streams

| Method | Path | Body / Query | Notes |
| --- | --- | --- | --- |
| GET | `/stream` | - | List all streams, newest first. |
| POST | `/stream` | `{ title, youtube_video_id, backup_youtube_video_id_1?, backup_youtube_video_id_2?, description?, setlist?, is_live? }` | Create. YouTube fields accept URLs or raw IDs. `is_live: true` ends other live streams. |
| PATCH | `/stream` | `{ stream_id, is_live?, youtube_video_id?, backup_youtube_video_id_1?, backup_youtube_video_id_2?, title?, description?, setlist?, stream_start_utc? }` | Update / go live / end / change stream sources. Broadcasts a refresh to viewers. |
| DELETE | `/stream` | `{ stream_id }` | Delete a stream and its chat/comments/tips (cascade). |

Notes:
- Going live (`is_live: true`) auto-stamps `stream_start_utc` and ends any other live stream.
- The viewer selector uses `youtube_video_id` as Main Stream, plus `backup_youtube_video_id_1` and `backup_youtube_video_id_2`.
- `setlist` here overrides the programme **for that one stream**; for the global programme use the setlist API instead.

### Members & moderators

| Method | Path | Body / Query | Notes |
| --- | --- | --- | --- |
| GET | `/members` | `?moderators_only=true`, `?admins_only=true`, `?banned=true|false` | Lists members with `login_url` + `assigned_password`. |
| POST | `/members` | `{ name, email, is_moderator?, is_admin?, display_name?, access_badges? }` | Add (upserts on email). Returns login credentials. Badges: `vip_member`, `private_student`, `dreamplay_buyer`. |
| PATCH | `/members` | `{ member_id, display_name?, name?, access_badges?, is_moderator?, is_admin?, is_banned?, regenerate_token? }` | Update. `is_admin` = full access, `is_moderator` = chat-only. Password rotation is disabled: `regenerate_token` does NOT change the password, it just returns the existing `login_url` + `assigned_password`. To deliver credentials, run `scripts/email-livestream-credentials.mjs`. |
| DELETE | `/members` | `{ member_id }` | Remove a member entirely. |

### Chat messages

| Method | Path | Body / Query | Notes |
| --- | --- | --- | --- |
| GET | `/messages` | `?stream_id=<uuid>&limit=100&include_muted=true` | Returns messages oldest->newest. `limit` max 500. |
| PATCH | `/messages` | `{ message_id, stream_id, is_muted }` | Hide/show a message; broadcasts in real time. |
| DELETE | `/messages` | `{ message_id, stream_id }` | Hard-delete a message; broadcasts removal. |

### Chat moderation (timeouts)

| Method | Path | Body / Query | Notes |
| --- | --- | --- | --- |
| POST | `/moderation` | `{ action: "timeout"|"mute", member_id, stream_id, minutes?, moderator_member_id? }` | `minutes` null/omitted = permanent. Falls back to the first moderator as the actor if `moderator_member_id` is omitted. |
| DELETE | `/moderation` | `{ member_id, stream_id }` | Clear all active timeouts for that member in the stream. |

### Comments (leave-a-note / guestbook)

| Method | Path | Body / Query | Notes |
| --- | --- | --- | --- |
| GET | `/comments` | `?stream_id=<uuid>&include_hidden=true` | List comments. |
| PATCH | `/comments` | `{ comment_id, is_approved }` | Approve (show) or hide. |
| DELETE | `/comments` | `{ comment_id }` | Hard-delete. |

### Tips

| Method | Path | Body / Query | Notes |
| --- | --- | --- | --- |
| GET | `/tips` | `?stream_id=<uuid>` | List tips with member info and a running dollar total. |

### Setlists

| Method | Path | Body / Query | Notes |
| --- | --- | --- | --- |
| GET | `/setlist` | `?slug=programme|belgium-tracker` | List or read; response includes full instructions. |
| PUT / PATCH | `/setlist` | `{ slug, data }` | Full-replace upsert (not a merge). |
| DELETE | `/setlist` | `{ slug }` | Revert that slug to its code default. |

See [agent-setlist-api.md](agent-setlist-api.md) for the data schemas.

### Broadcast (realtime)

| Method | Path | Body / Query | Notes |
| --- | --- | --- | --- |
| POST | `/broadcast` | `{ stream_id, event, payload }` | Send a custom realtime event to all viewers of a stream. |

Events the viewer UI already understands: `new_message`, `mute_message`,
`member_muted`, `member_unmuted`, `stream_live`, `stream_ended`,
`tip_received`, `announcement`.

---

## Safety notes for the agent

- Destructive actions (`DELETE` on members/streams/messages/comments) are
  permanent. Prefer reversible options first: hide a message (`is_muted`),
  ban instead of delete a member, end instead of delete a stream.
- There is only one live stream at a time. Before going a stream live, you do
  not need to manually end the previous one; the API does it for you.
- When in doubt about IDs or current state, call `GET /api/agent/status` and
  `GET /api/agent/stream` before writing.
