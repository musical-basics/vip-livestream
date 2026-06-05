'use client'

import type { Stream, SetlistItem } from '@/lib/database.types'
import { useState } from 'react'
import { ChevronDown, ChevronUp, Music2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { DEFAULT_SETLIST } from '@/lib/default-setlist'
import { CATEGORY_META } from '@/lib/setlist-category'

interface SetlistPanelProps {
  stream: Stream | null
}

export default function SetlistPanel({ stream }: SetlistPanelProps) {
  const [expanded, setExpanded] = useState<string | null>(null)

  // Use the stream's own setlist if it explicitly has one; otherwise fall back
  // to the default programme (currently the Belgium concert) so every stream,
  // including test streams, shows it without needing to be seeded.
  const setlist: SetlistItem[] =
    Array.isArray(stream?.setlist) && stream.setlist.length > 0
      ? (stream.setlist as unknown as SetlistItem[])
      : DEFAULT_SETLIST

  if (!setlist || setlist.length === 0) {
    return (
      <div className="text-center py-12">
        <Music2 className="w-8 h-8 text-muted-foreground opacity-30 mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">Programme to be announced</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {setlist.map((item, idx) => (
        <div key={item.id} className="glass rounded-xl overflow-hidden">
          <button
            className="group flex w-full items-start gap-3 px-3 py-4 text-left transition-colors hover:bg-white/3 sm:gap-4 sm:px-4"
            onClick={() => setExpanded(expanded === item.id ? null : item.id)}
          >
            <span
              className="text-lg font-light mt-0.5 w-6 shrink-0 text-center"
              style={{
                fontFamily: "'Cormorant Garamond', serif",
                color: 'oklch(0.75 0.12 85 / 0.5)',
              }}
            >
              {idx + 1}
            </span>
            <div className="flex-1 min-w-0">
              <p
                className="text-base font-medium leading-snug"
                style={{ fontFamily: "'Cormorant Garamond', serif" }}
              >
                {item.piece}
              </p>
              <p className="text-sm text-muted-foreground mt-0.5">
                {item.composer}
                {item.composerYears && (
                  <span className="text-xs opacity-60 ml-1">({item.composerYears})</span>
                )}
              </p>
              {item.category && (
                <Badge
                  variant="outline"
                  className={`mt-1.5 text-[10px] tracking-wide ${CATEGORY_META[item.category].className}`}
                >
                  {CATEGORY_META[item.category].label}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {item.duration && (
                <Badge variant="outline" className="text-[10px] hidden sm:inline-flex border-white/10 text-muted-foreground">
                  {item.duration}
                </Badge>
              )}
              {expanded === item.id ? (
                <ChevronUp className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              ) : (
                <ChevronDown className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              )}
            </div>
          </button>

          {expanded === item.id && (
            <div className="px-4 pb-4 pt-0 border-t border-white/5">
              <div className="mt-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                <div>
                  <p className="text-[10px] tracking-widest uppercase text-muted-foreground mb-1">Performer</p>
                  <p className="text-foreground/80">{item.performer}</p>
                </div>
                {item.duration && (
                  <div>
                    <p className="text-[10px] tracking-widest uppercase text-muted-foreground mb-1">Duration</p>
                    <p className="text-foreground/80">{item.duration}</p>
                  </div>
                )}
              </div>
              {item.notes && (
                <>
                  <Separator className="my-3 opacity-20" />
                  <p className="text-sm text-muted-foreground leading-relaxed italic">
                    {item.notes}
                  </p>
                </>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
