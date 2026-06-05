'use client'

import { useCallback, useSyncExternalStore } from 'react'
import { CalendarClock, MessageSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

const CONCERT_START_UTC = new Date('2026-06-11T17:00:00.000Z')
const CONCERT_TIME_CEST = 'Thursday, June 11th, 2026 at 7:00 PM CEST'

function subscribeToTimeZone() {
  return () => {}
}

function getLocalConcertTime() {
  if (typeof window === 'undefined') return ''

  return new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(CONCERT_START_UTC)
}

function getServerConcertTime() {
  return ''
}

interface ConcertAnnouncementDialogProps {
  open: boolean
  onClose: () => void
}

export default function ConcertAnnouncementDialog({
  open,
  onClose,
}: ConcertAnnouncementDialogProps) {
  const localConcertTime = useSyncExternalStore(
    subscribeToTimeZone,
    getLocalConcertTime,
    getServerConcertTime
  )

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    if (!nextOpen) onClose()
  }, [onClose])

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="glass max-w-md border-white/10 p-5 sm:p-6">
        <DialogHeader className="gap-3 pr-8">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[oklch(0.75_0.12_85)/15] text-[oklch(0.75_0.12_85)]">
            <CalendarClock className="h-5 w-5" />
          </div>
          <DialogTitle
            className="text-2xl font-light text-gold"
            style={{ fontFamily: "'Cormorant Garamond', serif" }}
          >
            Concert Livestream
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed text-muted-foreground">
            The concert livestream begins on {CONCERT_TIME_CEST}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
          {localConcertTime && (
            <div>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                Your local time
              </p>
              <p className="mt-1 text-sm text-foreground">{localConcertTime}</p>
            </div>
          )}

          <div className="flex gap-3 text-sm text-muted-foreground">
            <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-[oklch(0.75_0.12_85)]" />
            <div>
              <p>In the meantime, chat is open so you can say hello while you wait.</p>
              <p className="mt-2 text-xs text-gold/85 font-medium leading-normal">
                💡 Tip: Feel free to change your exposed name at the top of the chat panel if you want!
              </p>
            </div>
          </div>
        </div>

        <Button
          type="button"
          onClick={onClose}
          className="rounded-xl"
          style={{
            background: 'linear-gradient(135deg, oklch(0.75 0.12 85), oklch(0.60 0.10 70))',
            color: 'oklch(0.09 0.015 270)',
          }}
        >
          Got it
        </Button>
      </DialogContent>
    </Dialog>
  )
}
