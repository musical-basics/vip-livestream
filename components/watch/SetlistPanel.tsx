'use client'

import type { Stream, SetlistItem } from '@/lib/database.types'
import { useState } from 'react'
import { ChevronDown, ChevronUp, Music2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'

interface SetlistPanelProps {
  stream: Stream | null
}

// Default setlist — Belgium Concert, Theaterzaal Maupertuis, CC De Factorij,
// Zaventem · Thu 11 Jun 2026. Replaced by DB data when a stream supplies its own.
const DEMO_SETLIST: SetlistItem[] = [
  {
    id: '1',
    piece: 'Prelude in G minor, Op. 23 No. 5',
    composer: 'Sergei Rachmaninoff',
    composerYears: '1873–1943',
    performer: 'Lionel Yu',
    duration: '~4 min',
    notes: 'Opener. Solo piano.',
  },
  {
    id: '2',
    piece: 'Colors of the Soul',
    composer: 'Lionel Yu',
    performer: 'Lionel Yu',
    duration: '~4 min',
    notes: 'Original work for solo piano.',
  },
  {
    id: '3',
    piece: 'Gallop',
    composer: 'Lionel Yu',
    performer: 'Lionel Yu, with violin & cello (trio)',
    duration: '~5 min',
    notes: 'Trio arrangement.',
  },
  {
    id: '4',
    piece: 'La Campanella',
    composer: 'Franz Liszt',
    composerYears: '1811–1886',
    performer: 'Lionel Yu',
    duration: '~6 min',
    notes: "After Paganini. 'Nightmare' arrangement — solo piano with electronic backing.",
  },
  {
    id: '5',
    piece: 'Beethoven Virus',
    composer: 'after Ludwig van Beethoven',
    performer: 'Lionel Yu, with violin & cello (trio)',
    duration: '~4.5 min',
    notes: 'Trio arrangement.',
  },
  {
    id: '6',
    piece: 'Canon in Dream',
    composer: 'after Johann Pachelbel',
    composerYears: '1653–1706',
    performer: 'Lionel Yu',
    duration: '~4.5 min',
    notes: 'Electronic arrangement — solo piano with backing track.',
  },
  {
    id: '7',
    piece: 'Fight for Freedom',
    composer: 'Lionel Yu',
    performer: 'Lionel Yu',
    duration: '~5 min',
    notes: 'Original work for solo piano.',
  },
  {
    id: '8',
    piece: 'Winter Wind, Étude Op. 25 No. 11',
    composer: 'Frédéric Chopin',
    composerYears: '1810–1849',
    performer: 'Lionel Yu',
    duration: '~4 min',
    notes: 'Solo piano.',
  },
  {
    id: '9',
    piece: 'Moonlight Sonata',
    composer: 'Ludwig van Beethoven',
    composerYears: '1770–1827',
    performer: 'Lionel Yu',
    duration: '~6 min',
    notes: "'Nightmare' arrangement — solo piano with electronic backing.",
  },
  {
    id: '10',
    piece: 'Sunflowers',
    composer: 'Lionel Yu',
    performer: 'Lionel Yu',
    duration: '~5 min',
    notes: 'Original work for solo piano.',
  },
  {
    id: '11',
    piece: 'Dreams of a Violin',
    composer: 'Lionel Yu',
    performer: 'Lionel Yu, with violin (duet)',
    duration: '~5 min',
    notes: 'Violin and piano duet.',
  },
  {
    id: '12',
    piece: 'Für Elise',
    composer: 'Ludwig van Beethoven',
    composerYears: '1770–1827',
    performer: 'Lionel Yu',
    duration: '~5 min',
    notes: 'Dubstep arrangement — solo piano with electronic backing.',
  },
  {
    id: 'e1',
    piece: 'Fantaisie-Impromptu',
    composer: 'Frédéric Chopin',
    composerYears: '1810–1849',
    performer: 'Lionel Yu',
    duration: '~5 min',
    notes: 'Encore. Op. 66, solo piano.',
  },
  {
    id: 'e2',
    piece: 'Flight of the Bumblebee',
    composer: 'Nikolai Rimsky-Korsakov',
    composerYears: '1844–1908',
    performer: 'Lionel Yu',
    duration: '~2 min',
    notes: 'Encore. Solo piano.',
  },
  {
    id: 'e3',
    piece: 'Still D.R.E.',
    composer: 'after Dr. Dre',
    performer: 'Lionel Yu',
    duration: '~3.5 min',
    notes: 'Encore. Electronic arrangement — solo piano with backing track.',
  },
]

export default function SetlistPanel({ stream }: SetlistPanelProps) {
  const [expanded, setExpanded] = useState<string | null>(null)

  const setlist: SetlistItem[] =
    stream?.setlist
      ? (stream.setlist as unknown as SetlistItem[])
      : DEMO_SETLIST

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
            className="w-full flex items-start gap-4 px-4 py-4 text-left hover:bg-white/3 transition-colors group"
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
              <div className="grid grid-cols-2 gap-3 text-sm mt-3">
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
