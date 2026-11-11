import { useRef, useState, type CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { useFxPrefs } from '@/fx/prefs'
import { useFxStore } from '@/fx/runtime'
import { QUICK_EMOJIS } from '@/fx/emojis'
import { useRoomStore } from '@/store/roomStore'
import { NotoEmoji } from '@/components/game/NotoEmoji'
import { EmojiButton, EmojiPicker } from './EmojiPicker'

export const EMOJIS = QUICK_EMOJIS
const MAX = 5
const WINDOW_MS = 2000

export function ReactionLayer() {
  const floating = useFxStore(s => s.floating)
  const { effective } = useFxPrefs()
  if (floating.length === 0) return null
  if (effective === 'minimal') {
    const counts = new Map<string, number>()
    floating.forEach(f => counts.set(f.emoji, (counts.get(f.emoji) ?? 0) + 1))
    return (
      <div data-slot="reaction-counts" aria-hidden className="pointer-events-none absolute inset-x-0 bottom-2 z-30 flex justify-center gap-3">
        {[...counts].map(([emoji, n]) => <span key={emoji} className="animate-pp-fade rounded-full bg-muted px-2 py-0.5 text-sm"><NotoEmoji emoji={emoji} className="inline size-4 align-[-3px]" /> ×{n}</span>)}
      </div>
    )
  }
  return (
    <div data-slot="reaction-layer" aria-hidden className="pointer-events-none absolute inset-0 z-30 overflow-hidden">
      {floating.map(f => (
        // A full-height column rises straight up (translate % is of its own height); the emoji pops in and plays its own animation.
        <div
          key={f.id}
          data-slot="floating-reaction"
          className="animate-pp-rise absolute bottom-0 flex h-full w-14 -translate-x-1/2 items-end justify-center pb-4"
          style={{ left: `${f.x}%`, '--dur': `${f.dur}ms`, animationDelay: `${f.delay}ms` } as CSSProperties}
        >
          <span className="animate-pp-pop block drop-shadow-md" style={{ animationDelay: `${f.delay}ms` }}>
            <NotoEmoji emoji={f.emoji} animated className="size-12 text-4xl" />
          </span>
        </div>
      ))}
    </div>
  )
}

/** Client-side mirror of the server rate limit so spamming greys the buttons instead of failing silently. */
function useSendReaction() {
  const sendFx = useRoomStore(s => s.sendFx)
  const hits = useRef<number[]>([])
  const [blocked, setBlocked] = useState(false)
  const send = (emoji: string) => {
    const now = Date.now()
    hits.current = hits.current.filter(h => h > now - WINDOW_MS)
    if (hits.current.length >= MAX) return
    hits.current.push(now)
    if (hits.current.length >= MAX) {
      setBlocked(true)
      setTimeout(() => setBlocked(false), Math.max(0, hits.current[0]! + WINDOW_MS - now))
    }
    void sendFx('fx:react', { emoji }).catch(() => {})
  }
  return { send, blocked }
}

export function ReactionBar({ vertical = false }: { vertical?: boolean }) {
  const { t } = useTranslation()
  const { send, blocked } = useSendReaction()
  const buttonClass = `size-10 rounded-full text-xl transition-transform active:scale-90 disabled:opacity-40 ${vertical ? 'bg-background' : 'bg-muted'}`

  return (
    <div role="group" aria-label={t('fx.reactions')} className={`flex gap-2 ${vertical ? 'flex-col justify-center rounded-full bg-muted p-1.5' : 'justify-center'}`}>
      {EMOJIS.map(e => (
        <EmojiButton key={e} emoji={e} label={t('fx.react', { emoji: e })} disabled={blocked} onClick={() => send(e)} className={buttonClass} size="size-6 text-xl" />
      ))}
      <EmojiPicker vertical={vertical} blocked={blocked} onPick={send} triggerClass={buttonClass} />
    </div>
  )
}
