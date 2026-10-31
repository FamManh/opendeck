import { useTranslation } from 'react-i18next'
import { Crown, Eye } from 'lucide-react'
import { Mascot, isSpecies, type MascotState } from '@/components/game/Mascot'
import { PokerCard } from '@/components/game/PokerCard'
import type { Participant } from '@/domain'
import { SEAT_SIZE, type SeatDensity } from './seatLayout'

export type SeatStatus = 'idle' | 'voted' | 'thinking' | 'offline' | 'observer' | 'novote'

export interface SeatProps {
  participant: Participant
  voted: boolean
  /** Card id; only ever passed once the round is revealed. */
  vote: string | null
  revealed: boolean
  /** False before any round started: nobody is "thinking" yet. */
  hasRound?: boolean
  isHost?: boolean
  isMe?: boolean
  /** Overrides the mascot derived from status (sleeping / celebrating come from the fx layer). */
  mascot?: MascotState | undefined
  spot?: 'low' | 'high' | undefined
  density?: SeatDensity
  /** Where the card sits relative to the seat centre; without it the card stays on the mascot. */
  cardOffset?: { x: number; y: number } | null | undefined
  onThrow?: (() => void) | undefined
}

const MASCOT: Record<SeatStatus, MascotState> = {
  idle: 'idle', voted: 'voted', thinking: 'thinking', offline: 'away', observer: 'idle', novote: 'sleeping',
}
const MASCOT_SIZE: Record<SeatDensity, string> = { normal: 'size-16', compact: 'size-11', dense: 'size-7' }
const DOT: Record<SeatStatus, string> = {
  idle: 'bg-border', voted: 'bg-good', thinking: 'bg-primary', offline: 'bg-border', observer: 'bg-border', novote: 'bg-border',
}

export function seatStatus(p: Participant, voted: boolean, revealed: boolean, hasRound = true): SeatStatus {
  if (!p.online) return 'offline'
  if (p.role === 'observer') return 'observer'
  if (!hasRound) return 'idle'
  if (voted) return 'voted'
  return revealed ? 'novote' : 'thinking'
}

export function Seat({ participant: p, voted, vote, revealed, hasRound = true, isHost, isMe, mascot, spot, density = 'normal', cardOffset, onThrow }: SeatProps) {
  const { t } = useTranslation()
  const status = seatStatus(p, voted, revealed, hasRound)
  const showCard = p.role === 'voter' && voted
  const face = revealed && vote !== null
  const dense = density === 'dense'
  const size = SEAT_SIZE[density]
  const card = <PokerCard value={face ? vote : ''} faceUp={face} compact />
  return (
    <div
      data-slot="seat"
      data-pid={p.id}
      data-status={status}
      data-spot={spot}
      data-density={density}
      title={p.name}
      style={{ width: size.w, height: size.h }}
      className={`relative flex flex-col items-center gap-0.5 transition-opacity duration-300 ${status === 'offline' ? 'opacity-45' : ''}`}
    >
      <div className={`relative flex-none ${MASCOT_SIZE[density]} rounded-full ${spot ? 'ring-4 ring-primary' : ''}`}>
        <Mascot species={isSpecies(p.avatar) ? p.avatar : 'cat'} state={mascot ?? MASCOT[status]} />
        {isHost && <Crown aria-label={t('room.host')} className="absolute -top-1 -right-1 size-5 rounded-full bg-primary p-1 text-primary-foreground" />}
        {p.role === 'observer' && <Eye aria-label={t('room.status.observer')} className="absolute -right-1 -bottom-1 size-5 rounded-full bg-muted p-1" />}
        {showCard && !cardOffset && <div className="absolute -right-3 -bottom-1 z-10 h-[34px] w-6">{card}</div>}
      </div>
      {showCard && cardOffset && (
        <div className="absolute top-1/2 left-1/2 z-10 h-12 w-[34px]" style={{ transform: `translate(calc(-50% + ${cardOffset.x}px), calc(-50% + ${cardOffset.y}px))` }}>{card}</div>
      )}
      <div className={`max-w-full truncate rounded-full bg-muted font-semibold ${dense ? 'px-1.5 text-[10px]' : 'px-2.5 py-0.5 text-xs'}`}>
        {isMe && dense ? t('room.you') : p.name}{isMe && !dense ? ` · ${t('room.you')}` : ''}
      </div>
      {dense
        ? <><span aria-hidden className={`absolute top-0 left-0 size-2 rounded-full ${DOT[status]}`} /><span className="sr-only">{t(`room.status.${status}`)}</span></>
        : <div className="rounded-full bg-muted px-2 text-[11px] leading-tight font-semibold text-muted-foreground">{t(`room.status.${status}`)}</div>}
      {onThrow && <button type="button" onClick={onThrow} aria-label={t('fx.throwPlane')} className="absolute top-0 left-0 size-8 rounded-full bg-muted text-sm">✈️</button>}
    </div>
  )
}
