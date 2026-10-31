import { useTranslation } from 'react-i18next'
import { Crown } from 'lucide-react'
import { Mascot, isSpecies, type MascotState } from '@/components/game/Mascot'
import { PokerCard } from '@/components/game/PokerCard'
import type { Participant } from '@/domain'

export type SeatStatus = 'voted' | 'thinking' | 'offline' | 'observer' | 'novote'

export interface SeatProps {
  participant: Participant
  voted: boolean
  /** Card id; only ever passed once the round is revealed. */
  vote: string | null
  revealed: boolean
  isHost?: boolean
  isMe?: boolean
  /** Overrides the mascot derived from status (sleeping / celebrating come from the fx layer). */
  mascot?: MascotState | undefined
  spot?: 'low' | 'high' | undefined
  onThrow?: (() => void) | undefined
}

const MASCOT: Record<SeatStatus, MascotState> = {
  voted: 'voted', thinking: 'thinking', offline: 'away', observer: 'sleeping', novote: 'sleeping',
}

export function seatStatus(p: Participant, voted: boolean, revealed: boolean): SeatStatus {
  if (!p.online) return 'offline'
  if (p.role === 'observer') return 'observer'
  if (voted) return 'voted'
  return revealed ? 'novote' : 'thinking'
}

export function Seat({ participant: p, voted, vote, revealed, isHost, isMe, mascot, spot, onThrow }: SeatProps) {
  const { t } = useTranslation()
  const status = seatStatus(p, voted, revealed)
  const showCard = p.role === 'voter' && voted
  const face = revealed && vote !== null
  return (
    <div data-slot="seat" data-pid={p.id} data-status={status} data-spot={spot} className={`relative flex w-24 flex-col items-center gap-1 transition-opacity duration-300 ${status === 'offline' ? 'opacity-45' : ''}`}>
      <div className={`relative size-[72px] rounded-full ${spot ? 'ring-4 ring-primary' : ''}`}>
        <Mascot species={isSpecies(p.avatar) ? p.avatar : 'cat'} state={mascot ?? MASCOT[status]} />
        {isHost && <Crown aria-label={t('room.host')} className="absolute -top-1 -right-1 size-5 rounded-full bg-primary p-1 text-primary-foreground" />}
      </div>
      <div className="h-[52px] w-9">
        {showCard && <PokerCard value={face ? vote : ''} faceUp={face} compact />}
      </div>
      <div className="max-w-full truncate rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold">
        {p.name}{isMe ? ` · ${t('room.you')}` : ''}
      </div>
      <div className="text-[11px] font-semibold text-muted-foreground">{t(`room.status.${status}`)}</div>
      {onThrow && <button type="button" onClick={onThrow} aria-label={t('fx.throwPlane')} className="absolute top-0 left-0 size-9 rounded-full bg-muted text-base">✈️</button>}
    </div>
  )
}
