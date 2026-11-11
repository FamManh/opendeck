import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, Play, Plus, RotateCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { PublicRoomState } from '@/domain'
import { useElementSize } from '@/lib/useElementSize'
import { useIsMobile } from '@/lib/useIsMobile'
import { deriveMascotState, SLEEP_AFTER_MS } from '@/fx/mascotState'
import { useFxStore } from '@/fx/runtime'
import { bombOf } from '@/fx/bomb'
import { useFxPrefs } from '@/fx/prefs'
import { useRoomStore } from '@/store/roomStore'
import { FxLayers } from './fx/FxLayers'
import { useThrowItem } from './fx/ThrowMenu'
import { Seat } from './Seat'
import { seatLayout, type SeatDensity } from './seatLayout'

export interface TableProps {
  state: PublicRoomState
  pid: string | null
  isHost: boolean
  onStart: (itemId: string) => void
  onAdd?: (() => void) | undefined
  onSummary: () => void
  /** Host-only: turn the cards over. Shown in the middle of the table while voting. */
  onReveal?: (() => void) | undefined
}

function CurrentTask({ state, isHost, onStart, onAdd, onSummary }: Omit<TableProps, 'pid' | 'onReveal'>) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const cur = state.current
  const active = cur ? state.items.find(i => i.id === cur.itemId) : undefined
  const next = state.items.find(i => i.status === 'pending')
  const outcome = active ? undefined : [...state.outcomes].reverse()[0]

  if (!active) {
    return (
      <div data-slot="task-card" className="flex w-full max-w-sm flex-col items-center gap-3 rounded-3xl bg-card-paper px-5 py-4 text-center text-card-ink">
        {state.items.length === 0 ? (
          <>
            <div className="text-sm font-semibold">{t('room.noItems')}</div>
            {isHost && onAdd && <Button className="max-md:hidden" onClick={onAdd}><Plus />{t('room.addTasks')}</Button>}
          </>
        ) : next ? (
          <>
            {outcome && <div className="text-sm font-semibold text-good">{t('room.lastFinal', { value: outcome.value })}</div>}
            <div className="line-clamp-2 text-base font-semibold">{next.title}</div>
            {isHost
              ? <Button className="max-md:hidden" onClick={() => onStart(next.id)}><Play />{t(outcome ? 'room.startNext' : 'room.startRound')}</Button>
              : <div className="text-sm text-muted-foreground">{t('room.waitingHost')}</div>}
          </>
        ) : (
          <>
            <div className="text-base font-semibold">{t('room.allDone')}</div>
            <Button className="max-md:hidden" onClick={onSummary}>{t('room.viewSummary')}</Button>
          </>
        )}
      </div>
    )
  }
  return (
    <div data-slot="task-card" className="flex w-full max-w-sm flex-col gap-2 rounded-3xl bg-card-paper px-5 py-4 text-card-ink">
      <div className="flex items-center gap-2">
        {active.externalRef && <span className="rounded-full bg-primary px-2.5 py-0.5 text-[13px] font-semibold text-primary-foreground">{active.externalRef}</span>}
        <span className="ml-auto text-xs font-semibold text-muted-foreground">{t('room.round', { n: cur?.number })}</span>
      </div>
      <div title={active.title} className="line-clamp-2 text-lg leading-snug font-semibold">{active.title}</div>
      {active.description && (
        <>
          <button type="button" aria-expanded={open} onClick={() => setOpen(o => !o)} className="flex h-11 items-center gap-1.5 self-start rounded-lg bg-muted px-3 text-[13px] font-semibold md:h-8">
            {t('room.details')}<ChevronDown className={`size-3.5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
          </button>
          {open && <p className="max-h-24 overflow-y-auto text-[13px] leading-snug whitespace-pre-wrap">{active.description}</p>}
        </>
      )}
    </div>
  )
}

export function Table({ state, pid, isHost, onStart, onAdd, onSummary, onReveal }: TableProps) {
  const { t } = useTranslation()
  const mobile = useIsMobile()
  const { ref, size } = useElementSize<HTMLDivElement>({ w: 800, h: 500 })
  const cur = state.current
  const revealed = cur?.status === 'revealed'
  const hold = useFxStore(s => s.hold)
  const moment = useFxStore(s => s.moment)
  const discussion = useFxStore(s => s.discussion)
  const roundStartedAt = useFxStore(s => s.roundStartedAt)
  const sendFx = useRoomStore(s => s.sendFx)
  const hits = useFxStore(s => s.hits)
  const yawn = useFxStore(s => s.yawn)
  const { effective } = useFxPrefs()
  // Smoke waits for the blast to finish (and for the cards to be face up).
  const bomb = moment === 'bomb' || hold ? null : bombOf(state)
  const { throwItem, blocked: throwBlocked } = useThrowItem()
  const myHit = pid ? hits[pid]?.at(-1) : undefined
  useEffect(() => {
    if (myHit?.kind !== 'bomb' || myHit.level === 'minimal') return
    const shake = ref.current?.animate?.(
      [0, -9, 8, -6, 5, -3, 2, 0].map((x, i) => ({ transform: `translate(${x}px, ${i % 2 ? 3 : -3}px)` })),
      { duration: 480, easing: 'ease-out' },
    )
    return () => shake?.cancel()
  }, [myHit?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (cur?.status !== 'voting') return
    const id = setInterval(() => setNow(Date.now()), 5000)
    return () => clearInterval(id)
  }, [cur?.status])
  const ordered = Object.values(state.participants)
    .sort((a, b) => a.joinedAt - b.joinedAt)
    .sort((a, b) => Number(b.id === pid) - Number(a.id === pid))
  const canThrow = !!pid && state.participants[pid]?.role === 'voter'

  const seat = (p: (typeof ordered)[number], density: SeatDensity, cardOffset?: { x: number; y: number } | null) => {
    const voted = !!cur && (cur.voted.includes(p.id) || (revealed && cur.votes?.[p.id] !== undefined))
    const shown = revealed && (!hold || hold.all || hold.flipped.has(p.id))
    const cardId = shown ? (cur?.votes?.[p.id] ?? null) : null
    const mascot = deriveMascotState(p, {
      status: cur?.status ?? 'idle', voted, cardId, stats: cur?.stats ?? null, now, roundStartedAt, moment: moment === 'consensus' ? 'consensus' : null, yawn,
    })
    const asleep = canThrow && mascot === 'sleeping' && cur?.status === 'voting' && p.id !== pid && now - roundStartedAt > SLEEP_AFTER_MS
    const spot = moment === 'twist' && discussion ? (discussion.low.includes(p.id) ? 'low' : discussion.high.includes(p.id) ? 'high' : undefined) : undefined
    return (
      <Seat
        key={p.id}
        participant={p}
        voted={voted}
        vote={cardId}
        revealed={revealed}
        hasRound={!!cur}
        isHost={state.hostId === p.id}
        isMe={p.id === pid}
        mascot={p.online && !(mascot === 'thinking' || mascot === 'voted') ? mascot : undefined}
        spot={spot}
        density={density}
        cardOffset={cardOffset}
        onThrow={asleep ? () => void sendFx('fx:throw', { target: p.id, kind: 'plane' }).catch(() => {}) : undefined}
        onThrowItem={canThrow && p.id !== pid ? kind => throwItem(p.id, kind) : undefined}
        throwBlocked={throwBlocked}
        hits={hits[p.id]}
        smoke={!!bomb?.waiting.includes(p.id)}
        still={effective === 'minimal'}
        yawnDelay={Math.max(0, ordered.indexOf(p)) * 160}
      />
    )
  }
  const task = <CurrentTask state={state} isHost={isHost} onStart={onStart} onAdd={onAdd} onSummary={onSummary} />
  const layout = seatLayout(ordered.length, size.w, size.h)
  // Phones reveal from the bottom action bar instead.
  const revealButton = !mobile && isHost && onReveal && cur?.status === 'voting' && (
    <Button size="lg" data-slot="table-reveal" className="shadow-lg" disabled={cur.voted.length === 0} onClick={onReveal}>
      <RotateCw />{t('room.reveal')}
      <span className="tabular-nums opacity-70">{cur.voted.length}/{ordered.filter(p => p.role === 'voter' && p.online).length}</span>
    </Button>
  )

  if (mobile || layout.mode === 'grid') {
    const density: SeatDensity = mobile && ordered.length <= 24 ? 'compact' : 'dense'
    return (
      <div ref={ref} data-slot="table" data-fx={effective} className="relative flex h-full flex-col gap-3 px-3">
        <FxLayers state={state} isHost={isHost} />
        <div className="flex flex-wrap justify-center gap-x-1 gap-y-2">{ordered.map(p => seat(p, density))}</div>
        <div className="flex flex-col items-center gap-3 rounded-3xl bg-felt p-3">{task}{revealButton}</div>
      </div>
    )
  }
  return (
    <div ref={ref} data-slot="table" data-fx={effective} className="relative mx-auto h-full w-full">
      <FxLayers state={state} isHost={isHost} />
      <div className="absolute rounded-full bg-felt ring-8 ring-border" style={{ left: layout.felt.x, top: layout.felt.y, width: layout.felt.w, height: layout.felt.h }} />
      <div className="absolute top-1/2 left-1/2 z-10 flex w-[44%] max-w-sm -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-3">
        {task}
        {revealButton}
      </div>
      {ordered.map((p, i) => {
        const spot = layout.seats[i]!
        return (
          <div key={p.id} className="absolute z-20 -translate-x-1/2 -translate-y-1/2" style={{ left: spot.x, top: spot.y }}>
            {seat(p, layout.density, spot.card)}
          </div>
        )
      })}
    </div>
  )
}
