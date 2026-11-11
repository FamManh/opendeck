import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { LottieEmoji } from '@/components/game/LottieEmoji'
import { PokerCard } from '@/components/game/PokerCard'
import { isSpecialId, type PublicRoomState } from '@/domain'
import { bombOf } from '@/fx/bomb'
import { useFxPrefs } from '@/fx/prefs'
import { useFxStore } from '@/fx/runtime'
import { useRoomStore } from '@/store/roomStore'

/** The blast: a huge vector 💥 over the table and a short shake of the table itself. */
function Blast() {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const table = ref.current?.closest<HTMLElement>('[data-slot=table]')
    const shake = table?.animate?.(
      [0, -12, 10, -8, 6, -4, 2, 0].map((x, i) => ({ transform: `translate(${x}px, ${i % 2 ? 4 : -4}px)` })),
      { duration: 600, easing: 'ease-out' },
    )
    return () => shake?.cancel()
  }, [])
  return (
    <div ref={ref} data-slot="bomb-blast" aria-hidden className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center">
      <div className="animate-pp-blast aspect-square w-[min(70%,420px)]">
        <LottieEmoji emoji="💥" speed={1.2} className="size-full" />
      </div>
    </div>
  )
}

/** Shown to each person holding the lowest/highest card until they write why; it can't be dismissed. */
function ExplainPrompt({ state, pid, steps }: { state: PublicRoomState; pid: string; steps: number }) {
  const { t } = useTranslation()
  const send = useRoomStore(s => s.send)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const card = state.current?.votes?.[pid]
  if (!card) return null
  const label = isSpecialId(card) ? t(`cards.special.${card}`) : (state.scale.cards.find(c => c.id === card)?.label ?? card)
  const submit = () => {
    if (!text.trim()) return
    setBusy(true)
    void send({ type: 'reason', text }).catch(() => {}).finally(() => setBusy(false))
  }
  return (
    <form
      data-slot="explain-prompt"
      role="alertdialog"
      aria-labelledby="explain-title"
      onSubmit={e => { e.preventDefault(); submit() }}
      className="animate-pp-smoke-in absolute inset-x-3 bottom-3 z-40 mx-auto flex max-w-md flex-col gap-2.5 rounded-2xl bg-popover p-4 text-popover-foreground shadow-2xl ring-2 ring-stamp"
    >
      <div className="flex items-start gap-3">
        <div className="h-14 w-10 flex-none"><PokerCard value={card} compact /></div>
        <div className="min-w-0">
          <h2 id="explain-title" className="text-base font-[650]">{t('fx.bomb.title')}</h2>
          <p className="text-sm text-muted-foreground">{t('fx.bomb.body', { card: label, steps })}</p>
        </div>
      </div>
      <textarea
        autoFocus
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit() }}
        maxLength={280}
        rows={2}
        aria-label={t('fx.bomb.placeholder', { card: label })}
        placeholder={t('fx.bomb.placeholder', { card: label })}
        className="w-full resize-none rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring"
      />
      <Button type="submit" disabled={!text.trim() || busy} className="self-end">{t('fx.bomb.send')}</Button>
    </form>
  )
}

export function BombLayer({ state }: { state: PublicRoomState }) {
  const moment = useFxStore(s => s.moment)
  const hold = useFxStore(s => s.hold)
  const pid = useRoomStore(s => s.pid)
  const { effective } = useFxPrefs()
  const bomb = bombOf(state)
  if (!bomb || hold) return null
  const blasting = moment === 'bomb'
  return (
    <>
      {blasting && effective !== 'minimal' && <Blast />}
      {/* Let the blast finish before asking; after a reload there is no blast and the prompt shows at once. */}
      {!blasting && pid && bomb.waiting.includes(pid) && <ExplainPrompt state={state} pid={pid} steps={bomb.steps} />}
    </>
  )
}
