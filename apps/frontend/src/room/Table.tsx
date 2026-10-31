import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, Play, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { PublicRoomState } from '@/domain'
import { useIsMobile } from '@/lib/useIsMobile'
import { deriveMascotState, SLEEP_AFTER_MS } from '@/fx/mascotState'
import { useFxStore } from '@/fx/runtime'
import { useRoomStore } from '@/store/roomStore'
import { FxLayers } from './fx/FxLayers'
import { Seat } from './Seat'

export interface TableProps {
  state: PublicRoomState
  pid: string | null
  isHost: boolean
  onStart: (itemId: string) => void
  onAdd?: (() => void) | undefined
  onSummary: () => void
}

function CurrentTask({ state, isHost, onStart, onAdd, onSummary }: Omit<TableProps, 'pid'>) {
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
            {isHost && onAdd && <Button onClick={onAdd}><Plus />{t('room.addTasks')}</Button>}
          </>
        ) : next ? (
          <>
            {outcome && <div className="text-sm font-semibold text-good">{t('room.lastFinal', { value: outcome.value })}</div>}
            <div className="text-base font-semibold">{next.title}</div>
            {isHost
              ? <Button onClick={() => onStart(next.id)}><Play />{t(outcome ? 'room.startNext' : 'room.startRound')}</Button>
              : <div className="text-sm text-muted-foreground">{t('room.waitingHost')}</div>}
          </>
        ) : (
          <>
            <div className="text-base font-semibold">{t('room.allDone')}</div>
            <Button onClick={onSummary}>{t('room.viewSummary')}</Button>
          </>
        )}
      </div>
    )
  }
  return (
    <div data-slot="task-card" className="flex w-full max-w-sm flex-col gap-2 rounded-3xl bg-card-paper px-5 py-4 text-card-ink">
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-primary px-2.5 py-0.5 text-[13px] font-semibold text-primary-foreground">{active.externalRef ?? active.id}</span>
        <span className="ml-auto text-xs font-semibold text-muted-foreground">{t('room.round', { n: cur?.number })}</span>
      </div>
      <div className="text-lg leading-snug font-semibold">{active.title}</div>
      {active.description && (
        <>
          <button type="button" aria-expanded={open} onClick={() => setOpen(o => !o)} className="flex h-11 items-center gap-1.5 self-start rounded-full bg-muted px-3 text-[13px] font-semibold md:h-8">
            {t('room.details')}<ChevronDown className={`size-3.5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
          </button>
          {open && <p className="text-[13px] leading-snug whitespace-pre-wrap">{active.description}</p>}
        </>
      )}
    </div>
  )
}

export function Table({ state, pid, isHost, onStart, onAdd, onSummary }: TableProps) {
  const mobile = useIsMobile()
  const cur = state.current
  const revealed = cur?.status === 'revealed'
  const hold = useFxStore(s => s.hold)
  const moment = useFxStore(s => s.moment)
  const discussion = useFxStore(s => s.discussion)
  const roundStartedAt = useFxStore(s => s.roundStartedAt)
  const sendFx = useRoomStore(s => s.sendFx)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (cur?.status !== 'voting') return
    const id = setInterval(() => setNow(Date.now()), 5000)
    return () => clearInterval(id)
  }, [cur?.status])
  const ordered = Object.values(state.participants)
    .sort((a, b) => a.joinedAt - b.joinedAt)
    .sort((a, b) => Number(b.id === pid) - Number(a.id === pid))

  const seat = (p: (typeof ordered)[number]) => {
    const voted = !!cur && (cur.voted.includes(p.id) || (revealed && cur.votes?.[p.id] !== undefined))
    const shown = revealed && (!hold || hold.all || hold.flipped.has(p.id))
    const cardId = shown ? (cur?.votes?.[p.id] ?? null) : null
    const mascot = deriveMascotState(p, {
      status: cur?.status ?? 'idle', voted, cardId, stats: cur?.stats ?? null, now, roundStartedAt, moment: moment === 'consensus' ? 'consensus' : null,
    })
    const asleep = mascot === 'sleeping' && cur?.status === 'voting' && p.id !== pid && now - roundStartedAt > SLEEP_AFTER_MS
    const spot = moment === 'twist' && discussion ? (discussion.low.includes(p.id) ? 'low' : discussion.high.includes(p.id) ? 'high' : undefined) : undefined
    return (
      <Seat
        key={p.id}
        participant={p}
        voted={voted}
        vote={cardId}
        revealed={revealed}
        isHost={state.hostId === p.id}
        isMe={p.id === pid}
        mascot={p.online && !(mascot === 'thinking' || mascot === 'voted') ? mascot : undefined}
        spot={spot}
        onThrow={asleep ? () => void sendFx('fx:throw', { target: p.id, kind: 'paper' }).catch(() => {}) : undefined}
      />
    )
  }
  const task = <CurrentTask state={state} isHost={isHost} onStart={onStart} onAdd={onAdd} onSummary={onSummary} />

  if (mobile) {
    return (
      <div data-slot="table" className="relative flex flex-col gap-3 px-3">
        <FxLayers state={state} isHost={isHost} />
        <div className="flex flex-wrap justify-center gap-x-1 gap-y-2">{ordered.map(seat)}</div>
        <div className="flex justify-center rounded-3xl bg-felt p-3">{task}</div>
      </div>
    )
  }
  return (
    <div data-slot="table" className="relative mx-auto h-full min-h-[440px] w-full max-w-4xl">
      <FxLayers state={state} isHost={isHost} />
      <div className="absolute top-[48%] left-1/2 h-[56%] w-[78%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-felt" />
      <div className="absolute top-[47%] left-1/2 z-10 flex w-[44%] -translate-x-1/2 -translate-y-1/2 justify-center">{task}</div>
      {ordered.map((p, i) => {
        const a = (Math.PI / 2) + (i * 2 * Math.PI) / ordered.length
        return (
          <div key={p.id} className="absolute z-20 -translate-x-1/2 -translate-y-1/2" style={{ left: `${50 + 44 * Math.cos(a)}%`, top: `${46 + 40 * Math.sin(a)}%` }}>
            {seat(p)}
          </div>
        )
      })}
    </div>
  )
}
