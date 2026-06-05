'use client'

import { useState } from 'react'
import type { Member } from '@/lib/database.types'
import { Pencil, Check, X } from 'lucide-react'

interface DisplayNameEditorProps {
  member: Member
  displayName: string
  onChange: (name: string) => void
  highlight?: boolean
  nameColor: string | null
  onColorChange: (color: string | null) => void
}

const NAME_COLORS = [
  { label: 'Gold', value: 'oklch(0.75 0.12 85)' },
  { label: 'Emerald', value: 'oklch(0.78 0.15 140)' },
  { label: 'Ruby', value: 'oklch(0.70 0.16 25)' },
  { label: 'Sapphire', value: 'oklch(0.72 0.13 220)' },
  { label: 'Amethyst', value: 'oklch(0.74 0.14 300)' },
  { label: 'Amber', value: 'oklch(0.79 0.16 70)' },
  { label: 'Rose', value: 'oklch(0.76 0.13 350)' },
  { label: 'Sky', value: 'oklch(0.78 0.11 200)' },
]

export default function DisplayNameEditor({
  member,
  displayName,
  onChange,
  highlight,
  nameColor,
  onColorChange,
}: DisplayNameEditorProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState(displayName)
  const [selectedColor, setSelectedColor] = useState<string | null>(nameColor)
  const [isSaving, setIsSaving] = useState(false)
  const [hasDismissedHighlight, setHasDismissedHighlight] = useState(false)

  const showHighlight = highlight && !hasDismissedHighlight && !isEditing

  async function save() {
    if (!draft.trim()) {
      setIsEditing(false)
      return
    }
    setIsSaving(true)
    try {
      await fetch('/api/member/update-name', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          display_name: draft.trim(),
          name_color: selectedColor 
        }),
      })
      onChange(draft.trim())
      onColorChange(selectedColor)
      setIsEditing(false)
    } finally {
      setIsSaving(false)
    }
  }

  function cancel() {
    setDraft(displayName)
    setSelectedColor(nameColor)
    setIsEditing(false)
  }

  if (isEditing) {
    return (
      <div className="flex flex-col gap-2 p-2 bg-black/45 border border-white/10 rounded-xl max-w-[200px] z-50">
        <div className="flex items-center gap-1.5">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={32}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') save()
              if (e.key === 'Escape') cancel()
            }}
            className="text-xs bg-white/5 border border-[oklch(0.75_0.12_85)/50] rounded px-2 py-1 focus:outline-none flex-1"
          />
          <button
            onClick={save}
            disabled={isSaving}
            className="text-[oklch(0.75_0.12_85)] hover:opacity-80"
            title="Save changes"
          >
            <Check className="w-3.5 h-3.5" />
          </button>
          <button onClick={cancel} className="text-muted-foreground hover:opacity-80" title="Cancel">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        
        {/* Name color selection */}
        <div className="flex flex-col gap-1">
          <span className="text-[9px] text-muted-foreground/60 uppercase tracking-wider font-semibold select-none">Name Color</span>
          <div className="flex flex-wrap gap-1">
            {/* Default color option */}
            <button
              type="button"
              onClick={() => setSelectedColor(null)}
              className={`w-4.5 h-4.5 rounded-full border flex items-center justify-center text-[9px] font-bold transition-all ${
                selectedColor === null
                  ? 'border-[oklch(0.75_0.12_85)] bg-[oklch(0.75_0.12_85)]/15 text-[oklch(0.75_0.12_85)]'
                  : 'border-white/20 text-muted-foreground hover:border-white/40'
              }`}
              title="Default Color"
            >
              ×
            </button>
            {NAME_COLORS.map((c) => {
              const isActive = selectedColor === c.value
              return (
                <button
                  key={c.label}
                  type="button"
                  onClick={() => setSelectedColor(c.value)}
                  className={`w-4.5 h-4.5 rounded-full border transition-all hover:scale-110 ${
                    isActive ? 'border-white scale-105 shadow-inner shadow-black/45' : 'border-white/10'
                  }`}
                  style={{ backgroundColor: c.value }}
                  title={c.label}
                />
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="relative">
      <button
        onClick={() => {
          setIsEditing(true)
          setHasDismissedHighlight(true)
        }}
        className={`flex items-center gap-1.5 group hover:opacity-80 transition-all rounded-lg px-2 py-1 ${
          showHighlight
            ? 'ring-2 ring-[oklch(0.75_0.12_85)] bg-[oklch(0.75_0.12_85)/10] animate-pulse scale-105'
            : ''
        }`}
      >
        <span className="text-xs font-semibold" style={{ color: nameColor || 'oklch(0.75 0.12 85)' }}>
          {displayName}
        </span>
        <Pencil className={`w-3.5 h-3.5 transition-all ${
          showHighlight
            ? 'text-[oklch(0.75_0.12_85)] opacity-100'
            : 'text-muted-foreground/60 group-hover:text-foreground group-hover:opacity-100'
        }`} />
      </button>

      {showHighlight && (
        <div className="absolute top-full left-0 mt-2.5 z-50 bg-[oklch(0.75_0.12_85)] text-[oklch(0.09_0.015_270)] text-[10px] font-bold px-2.5 py-1.5 rounded-lg shadow-xl whitespace-nowrap animate-bounce flex items-center gap-1.5">
          <span>You can change your name here!</span>
          <button
            onClick={(e) => {
              e.stopPropagation()
              setHasDismissedHighlight(true)
            }}
            className="hover:opacity-80 ml-0.5 p-0.5"
            title="Dismiss tooltip"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  )
}
