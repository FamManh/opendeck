import { useState } from 'react'
import { notoAnimated, notoStatic } from '@/fx/emojis'

export interface NotoEmojiProps {
  emoji: string
  /** Play the animated WebP; otherwise show the static SVG of the same artwork. */
  animated?: boolean
  /** Defer loading until near the viewport (long picker grids). */
  lazy?: boolean
  className?: string
}

/** Noto (animated) emoji image; falls back to the system glyph if the CDN is unreachable. */
export function NotoEmoji({ emoji, animated = false, lazy = false, className = 'size-6' }: NotoEmojiProps) {
  const [failed, setFailed] = useState(false)
  if (failed) return <span className={`inline-flex items-center justify-center leading-none ${className}`}>{emoji}</span>
  return (
    <img
      src={animated ? notoAnimated(emoji) : notoStatic(emoji)}
      alt=""
      draggable={false}
      decoding="async"
      loading={lazy ? 'lazy' : undefined}
      onError={() => setFailed(true)}
      className={`pointer-events-none select-none ${className}`}
    />
  )
}
