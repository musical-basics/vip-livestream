'use client'

import { useState } from 'react'
import type { Member } from '@/lib/database.types'
import { Pencil, Check, X } from 'lucide-react'

interface DisplayNameEditorProps {
  member: Member
  displayName: string
  onChange: (name: string) => void
}

export default function DisplayNameEditor({ member, displayName, onChange }: DisplayNameEditorProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState(displayName)
  const [isSaving, setIsSaving] = useState(false)

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
    <button
      onClick={() => setIsEditing(true)}
      className="flex items-center gap-1.5 group hover:opacity-80 transition-opacity"
    >
      <span className="text-xs font-medium" style={{ color: 'oklch(0.75 0.12 85)' }}>
        {displayName}
      </span>
      <Pencil className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  )
}
