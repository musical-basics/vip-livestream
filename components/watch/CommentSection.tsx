'use client'

import { useState } from 'react'
import type { Member, Stream, Comment } from '@/lib/database.types'
import { Button } from '@/components/ui/button'
import { Loader2, MessageCircle, Send } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

interface CommentSectionProps {
  member: Member
  stream: Stream | null
  initialComments: Comment[]
}

export default function CommentSection({ member, stream, initialComments }: CommentSectionProps) {
  const [comments, setComments] = useState<Comment[]>(initialComments)
  const [content, setContent] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!content.trim()) return
    setIsSending(true)
    setError(null)

    try {
      const res = await fetch('/api/comments/post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stream_id: stream.id,
          content: content.trim(),
          display_name: member.display_name || member.name,
        }),
      })
      if (!res.ok) throw new Error('Failed to post')

      const { comment } = await res.json()
      setComments((prev) => [...prev, comment])
      setContent('')
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch {
      setError('Failed to post your note. Please try again.')
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Post form */}
      <div className="glass rounded-2xl p-4 sm:p-5">
        <h3
          className="text-lg font-light mb-4"
          style={{ fontFamily: "'Cormorant Garamond', serif", color: 'oklch(0.75 0.12 85)' }}
        >
          Leave a Note
        </h3>
        {!stream ? (
          <div className="flex flex-col items-center py-6 text-center gap-2">
            <span className="text-3xl">🎹</span>
            <p className="text-sm text-muted-foreground">
              Notes will be available once the performance begins.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Share your thoughts, feelings, or a message for the performer…"
              rows={4}
              maxLength={1000}
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm resize-none focus:outline-none focus:border-[oklch(0.75_0.12_85)] focus:ring-1 focus:ring-[oklch(0.75_0.12_85)] transition-colors placeholder:text-muted-foreground/40 leading-relaxed"
            />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-[11px] text-muted-foreground/50">{content.length}/1000</span>
              <Button
                type="submit"
                disabled={isSending || !content.trim()}
                size="sm"
                className="rounded-xl px-4 flex items-center gap-2"
                style={{
                  background: content.trim()
                    ? 'linear-gradient(135deg, oklch(0.75 0.12 85), oklch(0.60 0.10 70))'
                    : undefined,
                  color: content.trim() ? 'oklch(0.09 0.015 270)' : undefined,
                }}
              >
                {isSending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                Post Note
              </Button>
            </div>
            {success && (
              <p className="text-xs text-[oklch(0.72_0.14_160)]">
                ✓ Your note has been posted!
              </p>
            )}
            {error && (
              <p className="text-xs text-destructive">{error}</p>
            )}
          </form>
        )}
      </div>

      {/* Comments list */}
      {comments.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <MessageCircle className="w-3.5 h-3.5" />
            {comments.length} note{comments.length !== 1 ? 's' : ''}
          </h4>
          {[...comments].reverse().map((comment) => (
            <div key={comment.id} className="glass rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[oklch(0.75_0.12_85)] to-[oklch(0.55_0.10_70)] flex items-center justify-center text-[10px] font-bold text-[oklch(0.09_0.015_270)]">
                  {comment.display_name[0]?.toUpperCase()}
                </div>
                <span className="text-sm font-medium">{comment.display_name}</span>
                <span className="text-xs text-muted-foreground ml-auto">
                  {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                </span>
              </div>
              <p className="text-sm text-foreground/80 leading-relaxed">{comment.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
