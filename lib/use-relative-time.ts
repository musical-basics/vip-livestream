'use client'

import { useState, useEffect } from 'react'
import { formatDistanceToNow } from 'date-fns'

function getDisplayDate(dateStr: string): Date {
  const d = new Date(dateStr)
  const now = new Date()
  return d > now ? now : d
}

export function useRelativeTime(createdAt: string): string {
  const [displayStr, setDisplayStr] = useState<string>(() => {
    return formatDistanceToNow(getDisplayDate(createdAt), { addSuffix: true })
  })

  useEffect(() => {
    let timerId: NodeJS.Timeout

    function update() {
      const displayDate = getDisplayDate(createdAt)
      const str = formatDistanceToNow(displayDate, { addSuffix: true })
      setDisplayStr(str)

      const diffMs = Date.now() - displayDate.getTime()
      const diffSecs = diffMs / 1000

      let delay = 60000 // default: 1 minute
      if (diffSecs < 60) {
        delay = 10000 // under 1 min: update every 10s
      } else if (diffSecs < 120) {
        delay = 30000 // under 2 min: update every 30s
      } else if (diffSecs < 3600) {
        delay = 60000 // under 1 hour: update every 1 min
      } else {
        delay = 3600000 // older: update every 1 hour
      }

      timerId = setTimeout(update, delay)
    }

    // Initialize immediate timer run to keep sync
    update()

    return () => {
      if (timerId) clearTimeout(timerId)
    }
  }, [createdAt])

  return displayStr
}
