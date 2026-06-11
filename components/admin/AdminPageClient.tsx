'use client'

import { useState } from 'react'
import type { Member, Stream } from '@/lib/database.types'
import { MEMBER_BADGES, getMemberBadge, normalizeMemberBadges, type MemberBadgeId } from '@/lib/member-badges'
import { ROLE_BADGE } from '@/lib/roles'
import { extractYouTubeVideoId } from '@/lib/youtube'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import {
  Radio,
  Tv,
  Users,
  Plus,
  Save,
  Power,
  PowerOff,
  ExternalLink,
  Shield,
  ShieldOff,
  Crown,
  Ban,
  CheckCircle,
  Loader2,
  Settings,
  ArrowLeft,
  Archive,
  RefreshCw,
  Mail,
} from 'lucide-react'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { sendStreamLinksAction, sendTestStreamLinksAction } from '@/app/actions'

interface AdminPageClientProps {
  currentMember: Member
  streams: Stream[]
  members: Member[]
}

interface StreamLinkDraft {
  youtube_video_id: string
  backup_youtube_video_id_1: string
}

function streamToLinkDraft(stream: Stream): StreamLinkDraft {
  return {
    youtube_video_id: stream.youtube_video_id,
    backup_youtube_video_id_1: stream.backup_youtube_video_id_1 ?? '',
  }
}

export default function AdminPageClient({ currentMember, streams, members }: AdminPageClientProps) {
  const [streamList, setStreamList] = useState<Stream[]>(streams)
  const [memberList, setMemberList] = useState<Member[]>(members)
  const [isCreating, setIsCreating] = useState(false)
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [linkDrafts, setLinkDrafts] = useState<Record<string, StreamLinkDraft>>(
    () => Object.fromEntries(streams.map((stream) => [stream.id, streamToLinkDraft(stream)]))
  )
  const [emailStatus, setEmailStatus] = useState<string | null>(null)
  const [testEmail, setTestEmail] = useState(currentMember.email)

  // New stream form
    const [newStream, setNewStream] = useState({
      title: '',
      youtube_video_id: '',
      backup_youtube_video_id_1: '',
      description: '',
      setlist: '',
    })

  async function createStream() {
    if (!newStream.title || !newStream.youtube_video_id) return
    setLoadingId('new')
    const videoId = extractYouTubeVideoId(newStream.youtube_video_id)
    const backupVideoId1 = newStream.backup_youtube_video_id_1.trim()
      ? extractYouTubeVideoId(newStream.backup_youtube_video_id_1)
      : ''
    if (!videoId) {
      alert('Please enter a valid YouTube video URL or video ID.')
      setLoadingId(null)
      return
    }
    if (newStream.backup_youtube_video_id_1.trim() && !backupVideoId1) {
      alert('Please enter a valid Backup Stream 1 YouTube URL or video ID.')
      setLoadingId(null)
      return
    }

    let parsedSetlist = null
    if (newStream.setlist.trim()) {
      try {
        parsedSetlist = JSON.parse(newStream.setlist)
      } catch {
        alert('Setlist JSON is invalid. Please check the format.')
        setLoadingId(null)
        return
      }
    }

    const res = await fetch('/api/admin/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
          title: newStream.title,
          youtube_video_id: videoId,
        backup_youtube_video_id_1: backupVideoId1 || null,
          description: newStream.description || null,
        setlist: parsedSetlist,
      }),
    })

    if (res.ok) {
      const { stream } = await res.json()
      setStreamList((prev) => [stream, ...prev])
      setLinkDrafts((prev) => ({ ...prev, [stream.id]: streamToLinkDraft(stream) }))
      setNewStream({
        title: '',
        youtube_video_id: '',
        backup_youtube_video_id_1: '',
        description: '',
        setlist: '',
      })
      setIsCreating(false)
    }
    setLoadingId(null)
  }

  async function toggleLive(stream: Stream) {
    setLoadingId(stream.id)
    const goLive = !stream.is_live

    const res = await fetch('/api/admin/stream', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        stream_id: stream.id,
        is_live: goLive,
        ...(goLive && { stream_start_utc: new Date().toISOString() }),
      }),
    })

    if (res.ok) {
      const { stream: updatedStream } = await res.json()
      setStreamList((prev) =>
        prev.map((s) =>
          s.id === stream.id
            ? updatedStream
            : goLive
              ? { ...s, is_live: false }
            : s
          )
        )
      // Going live does NOT touch the stream URLs, so do not overwrite the link
      // editor with the stored values — that would silently discard any new URL
      // an operator typed but hasn't saved yet (use "Save Stream Sources" for
      // links). Only seed a draft if this stream somehow has none.
      setLinkDrafts((prev) =>
        prev[updatedStream.id]
          ? prev
          : { ...prev, [updatedStream.id]: streamToLinkDraft(updatedStream) }
      )
    }
    setLoadingId(null)
  }

  async function forceRefreshViewers(streamId: string) {
    setLoadingId(`refresh-${streamId}`)
    try {
      const res = await fetch('/api/admin/stream', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stream_id: streamId,
          force_refresh: true,
        }),
      })
      if (!res.ok) {
        alert('Failed to send refresh signal.')
      }
    } catch (err) {
      console.error(err)
      alert('An error occurred while trying to send the refresh signal.')
    } finally {
      setLoadingId(null)
    }
  }

  async function updateStreamLinks(stream: Stream) {
    const draft = linkDrafts[stream.id] ?? streamToLinkDraft(stream)

    // Blank = "leave this stream as-is" (never cleared, never an error). Only the
    // fields the operator actually fills get swapped, so they can fix the main
    // feed, a backup, or both without disturbing the others — e.g. when a venue
    // internet blip forces restarting more than one stream with new links.
    const body: {
      stream_id: string
      youtube_video_id?: string
      backup_youtube_video_id_1?: string
    } = { stream_id: stream.id }

    const linkFields: Array<{
      field: 'youtube_video_id' | 'backup_youtube_video_id_1'
      label: string
    }> = [
      { field: 'youtube_video_id', label: 'Main Stream' },
      { field: 'backup_youtube_video_id_1', label: 'Backup Stream 1' },
    ]

    for (const { field, label } of linkFields) {
      const raw = draft[field].trim()
      if (!raw) continue // blank → keep whatever is currently set
      const id = extractYouTubeVideoId(raw)
      if (!id) {
        alert(`Please enter a valid ${label} YouTube URL or video ID — or clear it to leave that stream unchanged.`)
        return
      }
      body[field] = id
    }

    if (
      body.youtube_video_id === undefined &&
      body.backup_youtube_video_id_1 === undefined
    ) {
      alert('Nothing to update — paste a new link into at least one field. Blank fields keep their current link.')
      return
    }

    setLoadingId(`links-${stream.id}`)
    try {
      const res = await fetch('/api/admin/stream', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        alert('Failed to update stream sources.')
        return
      }

      const { stream: updatedStream } = await res.json()
      setStreamList((prev) => prev.map((item) => (item.id === stream.id ? updatedStream : item)))
      setLinkDrafts((prev) => ({ ...prev, [stream.id]: streamToLinkDraft(updatedStream) }))
    } catch (err) {
      console.error(err)
      alert('An error occurred while updating stream sources.')
    } finally {
      setLoadingId(null)
    }
  }

  async function handleEmailLinks(stream: Stream) {
    const activeMembers = memberList.filter(m => !m.is_banned)
    const confirmSend = window.confirm(
      `Are you sure you want to email the stream links for "${stream.title}" to all ${activeMembers.length} active members?`
    )
    if (!confirmSend) return

    setLoadingId(`email-${stream.id}`)
    setEmailStatus(`Sending emails to ${activeMembers.length} members...`)

    try {
      const result = await sendStreamLinksAction(stream.id)
      if (result.error) {
        alert(`Error: ${result.error}`)
      } else {
        alert(`Successfully sent emails to ${result.sentCount} members (failed: ${result.failedCount}).`)
      }
    } catch (err) {
      console.error(err)
      alert('An unexpected error occurred while sending emails.')
    } finally {
      setLoadingId(null)
      setEmailStatus(null)
    }
  }

  async function handleSendTestEmail(stream: Stream) {
    if (!testEmail?.trim()) {
      alert('Please enter a test email address.')
      return
    }

    setLoadingId(`test-email-${stream.id}`)
    setEmailStatus(`Sending test email to ${testEmail}...`)

    try {
      const result = await sendTestStreamLinksAction(stream.id, testEmail)
      if (result.error) {
        alert(`Error: ${result.error}`)
      } else {
        alert(`Successfully sent test email to ${testEmail}.`)
      }
    } catch (err) {
      console.error(err)
      alert('An unexpected error occurred while sending test email.')
    } finally {
      setLoadingId(null)
      setEmailStatus(null)
    }
  }

  async function toggleModerator(member: Member) {
    setLoadingId(member.id)
    const res = await fetch('/api/admin/member', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ member_id: member.id, is_moderator: !member.is_moderator }),
    })
    if (res.ok) {
      setMemberList((prev) =>
        prev.map((m) => (m.id === member.id ? { ...m, is_moderator: !m.is_moderator } : m))
      )
    }
    setLoadingId(null)
  }

  async function toggleAdmin(member: Member) {
    setLoadingId(member.id)
    const res = await fetch('/api/admin/member', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ member_id: member.id, is_admin: !member.is_admin }),
    })
    if (res.ok) {
      setMemberList((prev) =>
        prev.map((m) => (m.id === member.id ? { ...m, is_admin: !m.is_admin } : m))
      )
    }
    setLoadingId(null)
  }

  async function toggleBan(member: Member) {
    setLoadingId(member.id)
    const res = await fetch('/api/admin/member', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ member_id: member.id, is_banned: !member.is_banned }),
    })
    if (res.ok) {
      setMemberList((prev) =>
        prev.map((m) => (m.id === member.id ? { ...m, is_banned: !m.is_banned } : m))
      )
    }
    setLoadingId(null)
  }

    async function toggleBadge(member: Member, badgeId: MemberBadgeId) {
    const currentBadges = normalizeMemberBadges(member.access_badges)
    const nextBadges = currentBadges.includes(badgeId)
      ? currentBadges.filter((badge) => badge !== badgeId)
      : [...currentBadges, badgeId]

    setLoadingId(member.id)
    const res = await fetch('/api/admin/member', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ member_id: member.id, access_badges: nextBadges }),
    })
    if (res.ok) {
      const { member: updatedMember } = await res.json()
      setMemberList((prev) =>
        prev.map((m) => (m.id === member.id ? { ...m, access_badges: updatedMember.access_badges } : m))
      )
    }
      setLoadingId(null)
    }

  function renderStreamLinkEditor(stream: Stream) {
    const draft = linkDrafts[stream.id] ?? streamToLinkDraft(stream)

    const updateDraft = (field: keyof StreamLinkDraft, value: string) => {
      setLinkDrafts((prev) => ({
        ...prev,
        [stream.id]: {
          ...(prev[stream.id] ?? draft),
          [field]: value,
        },
      }))
    }

    return (
      <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="space-y-1.5">
            <span className="block text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Main Stream
            </span>
            <input
              value={draft.youtube_video_id}
              onChange={(e) => updateDraft('youtube_video_id', e.target.value)}
              placeholder="Leave blank to keep current"
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 font-mono text-xs transition-colors focus:border-[oklch(0.75_0.12_85)] focus:outline-none"
            />
          </label>
          <label className="space-y-1.5">
            <span className="block text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Backup Stream 1
            </span>
            <input
              value={draft.backup_youtube_video_id_1}
              onChange={(e) => updateDraft('backup_youtube_video_id_1', e.target.value)}
              placeholder="Leave blank to keep current"
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 font-mono text-xs transition-colors focus:border-[oklch(0.75_0.12_85)] focus:outline-none"
            />
          </label>
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
          Paste a new YouTube link (full URL or ID) into any feed to swap it. Fill one or
          both — <span className="text-foreground">a blank field keeps its current link, never erases it.</span>{' '}
          Viewers switch automatically, no refresh needed.
        </p>
        <div className="mt-3 flex justify-end">
          <Button
            onClick={() => updateStreamLinks(stream)}
            disabled={loadingId === `links-${stream.id}`}
            size="sm"
            variant="outline"
            className="flex items-center justify-center gap-2 rounded-xl border border-white/10 hover:bg-white/5"
          >
            {loadingId === `links-${stream.id}` ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5 text-[oklch(0.75_0.12_85)]" />
            )}
            Save Stream Sources
          </Button>
        </div>

        <div className="mt-3 pt-3 border-t border-white/5 flex flex-wrap items-center justify-between gap-3">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Test Email Links
          </span>
          <div className="flex items-center gap-2 flex-1 max-w-sm">
            <input
              type="email"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              placeholder="admin@example.com"
              className="w-full rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs focus:border-[oklch(0.75_0.12_85)] focus:outline-none"
            />
            <Button
              onClick={() => handleSendTestEmail(stream)}
              disabled={loadingId !== null || !testEmail?.trim()}
              size="xs"
              variant="secondary"
              className="rounded-lg text-[10px] font-semibold tracking-wider uppercase h-7 px-3 bg-white/10 hover:bg-white/15 hover:text-white"
            >
              {loadingId === `test-email-${stream.id}` ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                'Send Test'
              )}
            </Button>
          </div>
        </div>
      </div>
    )
  }

    const liveStream = streamList.find((s) => s.is_live)
  const currentStream = liveStream ?? streamList[0] ?? null
  const archivedStreams = currentStream
    ? streamList.filter((stream) => stream.id !== currentStream.id)
    : []

  return (
    <div className="min-h-[100dvh]">
      {/* Header */}
      <header className="glass-heavy flex flex-wrap items-center gap-3 border-b border-border/50 px-4 py-4 sm:gap-4 sm:px-6">
        <Link href="/watch" className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden min-[360px]:inline">Back to Stream</span>
          <span className="min-[360px]:hidden">Back</span>
        </Link>
        <Separator orientation="vertical" className="hidden h-5 opacity-30 sm:block" />
        <div className="flex items-center gap-2">
          <Settings className="w-4 h-4 text-[oklch(0.75_0.12_85)]" />
          <span
            className="text-lg font-light text-gold"
            style={{ fontFamily: "'Cormorant Garamond', serif" }}
          >
            Stream Admin
          </span>
        </div>
        <Link href="/recordings" className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-white/8 hover:text-foreground">
          <Archive className="h-3.5 w-3.5" />
          Recordings
        </Link>
        <Link href="/logs" className="rounded-lg px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-white/8 hover:text-foreground">
          Logs
        </Link>
        <Link href="/analytics" className="rounded-lg px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-white/8 hover:text-foreground">
          Analytics
        </Link>
        {liveStream && (
          <div className="min-w-0 flex items-center gap-2 rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1 sm:ml-auto">
            <Radio className="w-3 h-3 text-red-400" />
            <span className="truncate text-xs font-semibold uppercase tracking-widest text-red-400">
              Live: {liveStream.title}
            </span>
          </div>
        )}
      </header>

      <div className="mx-auto max-w-5xl p-4 sm:p-6">
        <Tabs defaultValue="streams">
          <TabsList className="glass mb-6 grid w-full grid-cols-2 sm:inline-flex sm:w-auto">
            <TabsTrigger value="streams" className="flex items-center justify-center gap-2">
              <Tv className="w-3.5 h-3.5" />
              Streams
            </TabsTrigger>
            <TabsTrigger value="members" className="flex items-center justify-center gap-2">
              <Users className="w-3.5 h-3.5" />
              Members ({memberList.length})
            </TabsTrigger>
          </TabsList>

          {/* ── STREAMS TAB ── */}
          <TabsContent value="streams" className="space-y-4">
            {emailStatus && (
              <div className="flex items-center gap-2.5 rounded-xl border border-[oklch(0.75_0.12_85)]/30 bg-[oklch(0.75_0.12_85)]/10 px-4 py-3 text-sm text-[oklch(0.75_0.12_85)]">
                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                <span>{emailStatus}</span>
              </div>
            )}
            {/* Create new stream button */}
            {!isCreating && (
              <Button
                onClick={() => setIsCreating(true)}
                className="flex items-center gap-2 rounded-xl"
                style={{
                  background: 'linear-gradient(135deg, oklch(0.75 0.12 85), oklch(0.60 0.10 70))',
                  color: 'oklch(0.09 0.015 270)',
                }}
              >
                <Plus className="w-4 h-4" />
                New Stream
              </Button>
            )}

            {/* Create stream form */}
            {isCreating && (
              <div className="glass space-y-4 rounded-2xl p-4 sm:p-6">
                <h3
                  className="text-xl font-light text-gold"
                  style={{ fontFamily: "'Cormorant Garamond', serif" }}
                >
                  Create New Stream
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium tracking-widest uppercase text-muted-foreground mb-1.5">
                      Stream Title *
                    </label>
                    <input
                      value={newStream.title}
                      onChange={(e) => setNewStream((p) => ({ ...p, title: e.target.value }))}
                      placeholder="VIP Piano Recital — June 2026"
                      className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-[oklch(0.75_0.12_85)] transition-colors"
                    />
                  </div>
                    <div>
                      <label className="block text-xs font-medium tracking-widest uppercase text-muted-foreground mb-1.5">
                        Main Stream *
                      </label>
                      <input
                        value={newStream.youtube_video_id}
                      onChange={(e) => setNewStream((p) => ({ ...p, youtube_video_id: e.target.value }))}
                      placeholder="https://youtube.com/live/bEF9k5bGM2c?feature=share"
                      className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-[oklch(0.75_0.12_85)] transition-colors font-mono"
                    />
                    <p className="text-[11px] text-muted-foreground/60 mt-1">
                        Paste the YouTube live/share URL or just the video ID.
                      </p>
                    </div>
                  <div>
                    <label className="block text-xs font-medium tracking-widest uppercase text-muted-foreground mb-1.5">
                      Backup Stream 1
                    </label>
                    <input
                      value={newStream.backup_youtube_video_id_1}
                      onChange={(e) => setNewStream((p) => ({ ...p, backup_youtube_video_id_1: e.target.value }))}
                      placeholder="Optional YouTube live URL or video ID"
                      className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-[oklch(0.75_0.12_85)] transition-colors font-mono"
                    />
                  </div>
                  </div>
                <div>
                  <label className="block text-xs font-medium tracking-widest uppercase text-muted-foreground mb-1.5">
                    Description
                  </label>
                  <textarea
                    value={newStream.description}
                    onChange={(e) => setNewStream((p) => ({ ...p, description: e.target.value }))}
                    placeholder="An intimate evening of classical piano music."
                    rows={2}
                    className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm resize-none focus:outline-none focus:border-[oklch(0.75_0.12_85)] transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium tracking-widest uppercase text-muted-foreground mb-1.5">
                    Setlist (JSON — optional)
                  </label>
                  <textarea
                    value={newStream.setlist}
                    onChange={(e) => setNewStream((p) => ({ ...p, setlist: e.target.value }))}
                    placeholder={`[\n  {\n    "id": "1",\n    "piece": "Ballade No. 1",\n    "composer": "Chopin",\n    "composerYears": "1810–1849",\n    "performer": "Artist Name",\n    "duration": "~9 min",\n    "notes": "Programme note here"\n  }\n]`}
                    rows={8}
                    className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm resize-y focus:outline-none focus:border-[oklch(0.75_0.12_85)] transition-colors font-mono text-xs"
                  />
                </div>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button
                    onClick={createStream}
                    disabled={loadingId === 'new' || !newStream.title || !newStream.youtube_video_id}
                    className="flex items-center justify-center gap-2 rounded-xl"
                    style={{
                      background: 'linear-gradient(135deg, oklch(0.75 0.12 85), oklch(0.60 0.10 70))',
                      color: 'oklch(0.09 0.015 270)',
                    }}
                  >
                    {loadingId === 'new' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Create Stream
                  </Button>
                  <Button variant="ghost" onClick={() => setIsCreating(false)} className="rounded-xl">
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {/* Stream list */}
            <div className="space-y-3">
              {streamList.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <Tv className="w-8 h-8 opacity-30 mx-auto mb-3" />
                  <p className="text-sm">No streams yet. Create one above.</p>
                </div>
              )}
              {currentStream && (
                <div className="pt-1">
                  <p className="text-[10px] text-muted-foreground tracking-widest uppercase mb-2">
                    Current Stream
                  </p>
                </div>
              )}
              {currentStream && [currentStream].map((stream) => (
                <div key={stream.id} className={`glass rounded-2xl border p-4 sm:p-5 ${stream.is_live ? 'border-red-500/30' : 'border-white/8'}`}>
                  <div className="flex items-start gap-4 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3
                          className="text-lg font-medium"
                          style={{ fontFamily: "'Cormorant Garamond', serif" }}
                        >
                          {stream.title}
                        </h3>
                        {stream.is_live && (
                          <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-[10px] tracking-widest">
                            LIVE
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        <span className="text-xs text-muted-foreground font-mono">
                          ID: {stream.youtube_video_id}
                        </span>
                        <a
                          href={`https://youtube.com/watch?v=${stream.youtube_video_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-[oklch(0.75_0.12_85)] hover:underline flex items-center gap-1"
                        >
                          <ExternalLink className="w-3 h-3" />
                          YouTube
                        </a>
                        {stream.stream_start_utc && (
                          <span className="text-xs text-muted-foreground">
                            Started {formatDistanceToNow(new Date(stream.stream_start_utc), { addSuffix: true })}
                          </span>
                        )}
                      </div>
                        {stream.description && (
                          <p className="text-sm text-muted-foreground mt-1.5">{stream.description}</p>
                        )}
                      {renderStreamLinkEditor(stream)}
                      </div>

                    {/* Go Live / End Stream / Refresh buttons */}
                    <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row">
                      {stream.is_live && (
                        <Button
                          onClick={() => forceRefreshViewers(stream.id)}
                          disabled={loadingId === `refresh-${stream.id}`}
                          size="sm"
                          variant="outline"
                          className="flex items-center justify-center gap-2 rounded-xl border border-white/10 hover:bg-white/5"
                        >
                          {loadingId === `refresh-${stream.id}` ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <RefreshCw className="w-3.5 h-3.5 text-[oklch(0.75_0.12_85)]" />
                          )}
                          Sync & Refresh Viewers
                        </Button>
                      )}
                      <Button
                        onClick={() => handleEmailLinks(stream)}
                        disabled={loadingId !== null}
                        size="sm"
                        variant="outline"
                        className="flex items-center justify-center gap-2 rounded-xl border border-white/10 hover:bg-white/5"
                      >
                        {loadingId === `email-${stream.id}` ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Mail className="w-3.5 h-3.5 text-[oklch(0.75_0.12_85)]" />
                        )}
                        Email Links to All
                      </Button>
                      <Button
                        onClick={() => toggleLive(stream)}
                        disabled={loadingId === stream.id}
                        size="sm"
                        className="flex w-full items-center justify-center gap-2 rounded-xl sm:w-auto"
                        style={stream.is_live ? {
                          background: 'oklch(0.20 0.02 270)',
                          border: '1px solid oklch(0.65 0.22 25 / 0.4)',
                          color: 'oklch(0.65 0.22 25)',
                        } : {
                          background: 'linear-gradient(135deg, oklch(0.60 0.22 25), oklch(0.45 0.18 10))',
                          color: 'white',
                        }}
                      >
                        {loadingId === stream.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : stream.is_live ? (
                          <><PowerOff className="w-3.5 h-3.5" /> End Stream</>
                        ) : (
                          <><Power className="w-3.5 h-3.5" /> Go Live</>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
              {archivedStreams.length > 0 && (
                <div className="pt-5">
                  <p className="text-[10px] text-muted-foreground tracking-widest uppercase mb-2">
                    Archive
                  </p>
                </div>
              )}
              {archivedStreams.map((stream) => (
                <div key={stream.id} className="glass rounded-2xl border border-white/8 p-4 opacity-80 sm:p-5">
                  <div className="flex items-start gap-4 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3
                          className="text-lg font-medium"
                          style={{ fontFamily: "'Cormorant Garamond', serif" }}
                        >
                          {stream.title}
                        </h3>
                        <Badge variant="outline" className="text-[10px] text-muted-foreground border-white/15">
                          ARCHIVED
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        <span className="text-xs text-muted-foreground font-mono">
                          ID: {stream.youtube_video_id}
                        </span>
                        <a
                          href={`https://youtube.com/watch?v=${stream.youtube_video_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-[oklch(0.75_0.12_85)] hover:underline flex items-center gap-1"
                        >
                          <ExternalLink className="w-3 h-3" />
                          YouTube
                        </a>
                        {stream.stream_start_utc && (
                          <span className="text-xs text-muted-foreground">
                            Started {formatDistanceToNow(new Date(stream.stream_start_utc), { addSuffix: true })}
                          </span>
                        )}
                      </div>
                      {stream.description && (
                        <p className="text-sm text-muted-foreground mt-1.5">{stream.description}</p>
                      )}
                    </div>
                    <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row">
                      <Button
                        onClick={() => handleEmailLinks(stream)}
                        disabled={loadingId !== null}
                        size="sm"
                        variant="outline"
                        className="flex items-center justify-center gap-2 rounded-xl border border-white/10 hover:bg-white/5"
                      >
                        {loadingId === `email-${stream.id}` ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Mail className="w-3.5 h-3.5 text-[oklch(0.75_0.12_85)]" />
                        )}
                        Email Links to All
                      </Button>
                      <Button
                        onClick={() => toggleLive(stream)}
                        disabled={loadingId === stream.id}
                        size="sm"
                        className="flex w-full shrink-0 items-center justify-center gap-2 rounded-xl sm:w-auto"
                        style={{
                          background: 'linear-gradient(135deg, oklch(0.60 0.22 25), oklch(0.45 0.18 10))',
                          color: 'white',
                        }}
                      >
                        {loadingId === stream.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <><Power className="w-3.5 h-3.5" /> Go Live</>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* ── MEMBERS TAB ── */}
          <TabsContent value="members" className="space-y-3">
            <p className="text-xs text-muted-foreground mb-4">
              Manage member badges, roles, and bans. Crown = admin (full access, can assign roles); shield = moderator (chat moderation only). Use the seed script or agent API to add new members.
            </p>
            {memberList.map((m) => (
              <div
                key={m.id}
                className={`glass flex flex-wrap items-center gap-3 rounded-xl px-3 py-3 sm:px-4 ${m.is_banned ? 'opacity-50' : ''}`}
              >
                {/* Avatar */}
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[oklch(0.75_0.12_85)] to-[oklch(0.55_0.10_70)] flex items-center justify-center text-xs font-bold text-[oklch(0.09_0.015_270)] shrink-0">
                  {(m.display_name || m.name)[0]?.toUpperCase()}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">{m.display_name || m.name}</span>
                    {m.display_name && m.display_name !== m.name && (
                      <span className="text-xs text-muted-foreground">({m.name})</span>
                    )}
                    {m.is_admin && (
                      <Badge variant="outline" className={`text-[10px] tracking-wide ${ROLE_BADGE.ADMIN.className}`}>
                        {ROLE_BADGE.ADMIN.emoji} ADMIN
                      </Badge>
                    )}
                    {m.is_moderator && (
                      <Badge variant="outline" className={`text-[10px] tracking-wide ${ROLE_BADGE.MOD.className}`}>
                        {ROLE_BADGE.MOD.emoji} MOD
                      </Badge>
                    )}
                    {m.is_banned && (
                      <Badge variant="outline" className="text-[10px] border-red-500/40 text-red-400">
                        BANNED
                      </Badge>
                    )}
                    {m.id === currentMember.id && (
                      <Badge variant="outline" className="text-[10px] text-muted-foreground">
                        You
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    {normalizeMemberBadges(m.access_badges).map((badgeId) => {
                      const badge = getMemberBadge(badgeId)
                      if (!badge) return null
                      return (
                        <Badge
                          key={badge.id}
                          variant="outline"
                          className={`text-[10px] ${badge.className}`}
                        >
                          <span className="mr-1">{badge.emoji}</span>
                          {badge.label}
                        </Badge>
                      )
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                </div>

                {/* Actions */}
                <div className="flex w-full shrink-0 flex-wrap items-center justify-end gap-3 sm:w-auto">
                  <div className="flex items-center gap-1 rounded-xl border border-white/8 bg-white/5 p-1">
                    {MEMBER_BADGES.map((badge) => {
                      const isSelected = normalizeMemberBadges(m.access_badges).includes(badge.id)
                      return (
                        <button
                          key={badge.id}
                          onClick={() => toggleBadge(m, badge.id)}
                          disabled={loadingId === m.id}
                          title={badge.label}
                          className={`px-2 py-1 rounded-lg text-xs transition-colors ${
                            isSelected
                              ? `${badge.className} border`
                              : 'text-muted-foreground hover:text-foreground hover:bg-white/10'
                          }`}
                        >
                          {badge.emoji}
                        </button>
                      )
                    })}
                  </div>
                  {m.id !== currentMember.id && (
                    <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleAdmin(m)}
                      disabled={loadingId === m.id}
                      title={m.is_admin ? 'Remove admin' : 'Make admin (full access)'}
                      className={`p-1.5 rounded-lg hover:bg-white/10 transition-colors ${m.is_admin ? 'text-[oklch(0.8_0.15_85)]' : 'text-muted-foreground hover:text-[oklch(0.8_0.15_85)]'}`}
                    >
                      <Crown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => toggleModerator(m)}
                      disabled={loadingId === m.id}
                      title={m.is_moderator ? 'Remove moderator' : 'Make moderator (chat only)'}
                      className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-muted-foreground hover:text-[oklch(0.75_0.12_85)]"
                    >
                      {loadingId === m.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : m.is_moderator ? (
                        <ShieldOff className="w-3.5 h-3.5" />
                      ) : (
                        <Shield className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <button
                      onClick={() => toggleBan(m)}
                      disabled={loadingId === m.id}
                      title={m.is_banned ? 'Unban member' : 'Ban member'}
                      className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-muted-foreground hover:text-destructive"
                    >
                      {m.is_banned ? (
                        <CheckCircle className="w-3.5 h-3.5" />
                      ) : (
                        <Ban className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                  )}
                </div>
              </div>
            ))}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
