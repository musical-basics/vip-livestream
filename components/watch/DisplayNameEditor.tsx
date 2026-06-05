'use client'

import { useState } from 'react'
import type { Member } from '@/lib/database.types'
import { Pencil, Check, X } from 'lucide-react'

interface DisplayNameEditorProps {
  member: Member
  displayName: string
  onChange: (name: string) => void
  highlight?: boolean
}

export default function DisplayNameEditor({ member, displayName, onChange, highlight }: DisplayNameEditorProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState(displayName)
  const [isSaving, setIsSaving] = useState(false)
  const [hasDismissedHighlight, setHasDismissedHighlight] = useState(false)

  const showHighlight = highlight && !hasDismissedHighlight && !isEditing

  async function save() {
    if (!draft.trim() || draft === displayName) {
      setIsEditing(false)
      return
    }
    setIsSaving(true)
    try {
      await fetch('/api/member/update-name', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ display_name: draft.trim() }),
      })
      onChange(draft.trim())
      setIsEditing(false)
    } finally {
      setIsSaving(false)
    }
  }

  function cancel() {
    setDraft(displayName)
    setIsEditing(false)
  }

  if (isEditing) {
    return (
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
          className="text-xs bg-white/5 border border-[oklch(0.75_0.12_85)/50] rounded px-2 py-1 focus:outline-none w-28"
        />
        <button
          onClick={save}
          disabled={isSaving}
          className="text-[oklch(0.75_0.12_85)] hover:opacity-80"
        >
          <Check className="w-3.5 h-3.5" />
        </button>
        <button onClick={cancel} className="text-muted-foreground hover:opacity-80">
          <X className="w-3.5 h-3.5" />
        </button>
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
        <span className="text-xs font-semibold" style={{ color: 'oklch(0.75 0.12 85)' }}>
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
