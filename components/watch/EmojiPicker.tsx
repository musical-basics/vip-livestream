'use client'

import { useEffect, useRef } from 'react'
import data from '@emoji-mart/data'
import Picker from '@emoji-mart/react'
import { X } from 'lucide-react'

// Piano-themed quick reactions
const QUICK_REACTIONS = ['🎹', '🎵', '🎶', '❤️', '👏', '🔥', '✨', '🌟', '💫', '🥹', '😭', '🫶']

interface EmojiPickerProps {
  onSelect: (emoji: string) => void
  onClose: () => void
}

export default function EmojiPicker({ onSelect, onClose }: EmojiPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  return (
    <div ref={containerRef} className="relative">
      {/* Quick reactions strip */}
      <div className="flex items-center gap-1 px-3 py-2 border-b border-border/30 flex-wrap">
        <span className="text-[10px] text-muted-foreground mr-1 tracking-wide">Quick:</span>
        {QUICK_REACTIONS.map((emoji) => (
          <button
            key={emoji}
            onClick={() => onSelect(emoji)}
            className="text-xl hover:scale-125 transition-transform p-0.5 rounded"
            title={emoji}
          >
            {emoji}
          </button>
        ))}
        <button
          onClick={onClose}
          className="ml-auto p-1 rounded hover:bg-white/10 transition-colors text-muted-foreground"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Full emoji picker */}
      <div className="emoji-picker-container overflow-hidden">
        <Picker
          data={data}
          onEmojiSelect={(e: any) => onSelect(e.native)}
          theme="dark"
          set="native"
          previewPosition="none"
          skinTonePosition="none"
          navPosition="bottom"
          perLine={8}
          maxFrequentRows={2}
        />
      </div>
    </div>
  )
}
