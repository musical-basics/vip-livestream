'use client'

interface EmojiOverlayProps {
  emojis: Array<{ id: string; emoji: string; x: number }>
}

export default function EmojiOverlay({ emojis }: EmojiOverlayProps) {
  if (emojis.length === 0) return null

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-20">
      {emojis.map(({ id, emoji, x }) => (
        <div
          key={id}
          className="absolute bottom-4 emoji-float text-4xl select-none drop-shadow-lg"
          style={{ left: `${x}%` }}
        >
          {emoji}
        </div>
      ))}
    </div>
  )
}
