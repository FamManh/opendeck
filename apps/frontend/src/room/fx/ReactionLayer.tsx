import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useFxPrefs } from '@/fx/prefs'
import { useFxStore } from '@/fx/runtime'
import { useRoomStore } from '@/store/roomStore'

export const EMOJIS = ['👏', '😂', '🤔', '😮'] as const
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
        {[...counts].map(([emoji, n]) => <span key={emoji} className="animate-pp-fade rounded-full bg-muted px-2 py-0.5 text-sm">{emoji} ×{n}</span>)}
      </div>
    )
  }
  return (
    <div data-slot="reaction-layer" aria-hidden className="pointer-events-none absolute inset-0 z-30 overflow-hidden">
      {floating.map(f => (
        <span key={f.id} data-slot="floating-reaction" className="animate-pp-react absolute bottom-4 text-3xl" style={{ left: `${f.x}%` }}>{f.emoji}</span>
      ))}
    </div>
  )
}

export function ReactionBar({ vertical = false }: { vertical?: boolean }) {
  const { t } = useTranslation()
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

  return (
    <div role="group" aria-label={t('fx.reactions')} className={`flex gap-2 ${vertical ? 'flex-col justify-center rounded-full bg-muted p-1.5' : 'justify-center'}`}>
      {EMOJIS.map(e => (
        <button
          key={e}
          type="button"
          disabled={blocked}
          aria-label={t('fx.react', { emoji: e })}
          onClick={() => send(e)}
          className={`size-10 rounded-full text-xl transition-opacity active:scale-90 disabled:opacity-40 ${vertical ? 'bg-background' : 'bg-muted'}`}
        >{e}</button>
      ))}
    </div>
  )
}
