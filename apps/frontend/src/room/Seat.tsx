import type { ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { Crown, Eye } from 'lucide-react'
import { Mascot, isSpecies, type MascotState } from '@/components/game/Mascot'
import { LottieEmoji } from '@/components/game/LottieEmoji'
import { NotoEmoji } from '@/components/game/NotoEmoji'
import type { Hit } from '@/fx/runtime'
import { hitJitter, type ItemKind } from '@/fx/throws'
import { Arrow } from './fx/Arrow'
import { ThrowMenu } from './fx/ThrowMenu'
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
  /** Makes the avatar a button that opens the throw tray. */
  onThrowItem?: ((kind: ItemKind) => void) | undefined
  throwBlocked?: boolean
  /** Things currently stuck on this seat, oldest first (each cleared after HIT_MS). */
  hits?: Hit[] | undefined
  /** Bomb: this person must explain their card; smoke hides them until they do. */
  smoke?: boolean
  /** Minimal effects: no motion in overlays. */
  still?: boolean
  /** Stagger for contagious yawning, ms. */
  yawnDelay?: number
}

/** A few grey puffs that drift over the avatar (and part of the name). */
function Smoke() {
  const puffs = [
    { x: 30, y: 34, r: 52, d: 0, px: '5%' }, { x: 66, y: 30, r: 56, d: 500, px: '-4%' }, { x: 48, y: 56, r: 62, d: 900, px: '3%' },
    { x: 20, y: 66, r: 44, d: 1300, px: '-5%' }, { x: 80, y: 62, r: 46, d: 700, px: '4%' }, { x: 50, y: 18, r: 40, d: 1600, px: '-3%' },
    { x: 46, y: 80, r: 42, d: 300, px: '4%' },
  ]
  return (
    <span data-slot="smoke" aria-hidden className="animate-pp-smoke-in pointer-events-none absolute inset-[-38%] z-20 block">
      {puffs.map((p, i) => (
        <span
          key={i}
          className="animate-pp-puff absolute rounded-full bg-[radial-gradient(circle_at_45%_40%,rgba(232,235,241,.97)_0%,rgba(176,182,196,.9)_42%,rgba(150,157,172,0)_70%)]"
          style={{ left: `${p.x - p.r / 2}%`, top: `${p.y - p.r / 2}%`, width: `${p.r}%`, height: `${p.r}%`, animationDelay: `${p.d}ms`, ['--px' as string]: p.px }}
        />
      ))}
    </span>
  )
}

const HIT_ANIM: Record<ItemKind, string> = {
  tomato: 'animate-pp-squash', poop: 'animate-pp-squash', roll: 'animate-pp-squash', arrow: 'animate-pp-squash', bomb: 'animate-pp-squash', heart: 'animate-pp-love',
}
const SPLAT: Partial<Record<ItemKind, { color: string; opacity: number }>> = {
  tomato: { color: '#e5383b', opacity: 0.88 }, poop: { color: '#7b4a2a', opacity: 0.9 }, bomb: { color: '#262626', opacity: 0.7 },
}
const BADGE: Partial<Record<ItemKind, string>> = { poop: '🪰', roll: '😵‍💫', heart: '💕' }

/** Juice / mud / soot over the face; drawn so it reads at every seat size. */
function Splat({ still, color, opacity }: { still: boolean; color: string; opacity: number }) {
  return (
    <svg data-slot="splat" viewBox="0 0 64 64" aria-hidden className={`pointer-events-none absolute inset-[-12%] z-10 ${still ? '' : 'animate-pp-splat'}`}>
      <path fill={color} fillOpacity={opacity} d="M32 10c5 0 6 6 10 6s7-4 10-1-1 7 1 10 8 3 7 8-6 4-6 8 4 8 0 10-7-2-10 1-3 9-8 9-5-6-9-6-7 5-10 2 1-7-2-10-9-2-9-7 6-4 6-8-6-6-3-9 7 1 9-2-1-9 3-11 6 2 8 2 3-10 8-10Z" />
      <circle cx="12" cy="52" r="3" fill={color} fillOpacity=".8" /><circle cx="54" cy="12" r="2.5" fill={color} fillOpacity=".8" />
      <circle cx="26" cy="28" r="3" fill="#fff" fillOpacity=".55" />
    </svg>
  )
}

function HitOverlay({ hit, index }: { hit: Hit; index: number }) {
  const still = hit.level === 'minimal'
  const splat = SPLAT[hit.kind]
  const badge = BADGE[hit.kind]
  const j = hitJitter(index, hit.id)
  return (
    <span data-slot="hit" data-kind={hit.kind} aria-hidden className="pointer-events-none absolute inset-0" style={{ transform: `translate(${j.x}%, ${j.y}%) rotate(${j.rot}deg)` }}>
      {splat && <Splat still={still} {...splat} />}
      {hit.kind === 'arrow' && (
        // Tip buried at the centre of the face, shaft sticking out to the upper left; it twangs on impact.
        <span data-slot="stuck-arrow" aria-hidden className="pointer-events-none absolute top-[22%] left-[-45%] z-10 block w-[95%] origin-right rotate-[28deg]">
          <span className={`block origin-right ${still ? '' : 'animate-pp-quiver'}`}><Arrow buried className="block w-full" /></span>
        </span>
      )}
      {hit.kind === 'bomb' && !still && (
        <span data-slot="boom" aria-hidden className="animate-pp-boom pointer-events-none absolute inset-[-40%] z-20">
          <NotoEmoji emoji="💥" animated className="size-full" />
        </span>
      )}
      {badge && (
        <span data-slot="hit-badge" aria-hidden className={`pointer-events-none absolute -top-4 left-1/2 z-10 -ml-3.5 ${still ? '' : 'animate-pp-float-up'}`}>
          <NotoEmoji emoji={badge} animated={!still} className="size-7" />
        </span>
      )}
    </span>
  )
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

export function Seat({ participant: p, voted, vote, revealed, hasRound = true, isHost, isMe, mascot, spot, density = 'normal', cardOffset, onThrow, onThrowItem, throwBlocked = false, hits = [], smoke = false, still = false, yawnDelay = 0 }: SeatProps) {
  const hit = hits.at(-1)
  const { t } = useTranslation()
  const status = seatStatus(p, voted, revealed, hasRound)
  const showCard = p.role === 'voter' && voted
  const face = revealed && vote !== null
  const dense = density === 'dense'
  const size = SEAT_SIZE[density]
  const card = <PokerCard value={face ? vote : ''} faceUp={face} compact />
  const Avatar = onThrowItem ? 'button' : 'div'
  const wrapAvatar = (el: ReactElement) =>
    onThrowItem ? <ThrowMenu name={p.name} blocked={throwBlocked} onPick={onThrowItem}>{el}</ThrowMenu> : el
  return (
    <div
      data-slot="seat"
      data-pid={p.id}
      data-status={status}
      data-spot={spot}
      data-density={density}
      title={p.name}
      data-smoke={smoke || undefined}
      style={{ width: size.w, height: size.h, ['--yawn-delay' as string]: `${yawnDelay}ms` }}
      className={`relative flex flex-col items-center gap-0.5 transition-opacity duration-300 ${status === 'offline' ? 'opacity-45' : ''}`}
    >
      {wrapAvatar(
        <Avatar
          {...(onThrowItem ? { type: 'button' as const, 'aria-label': t('fx.throwAt', { name: p.name }) } : {})}
          data-slot="seat-avatar"
          className={`relative block flex-none ${MASCOT_SIZE[density]} rounded-full ${spot ? 'ring-4 ring-primary' : ''} ${onThrowItem ? 'cursor-pointer outline-none focus-visible:ring-4 focus-visible:ring-ring' : ''}`}
        >
        {/* Keyed by hit id so every new hit restarts the squash. */}
        <div key={`m${hit?.id ?? 0}`} className={`size-full ${hit && hit.level !== 'minimal' ? HIT_ANIM[hit.kind] : ''}`}>
          <Mascot species={isSpecies(p.avatar) ? p.avatar : 'cat'} state={mascot ?? MASCOT[status]} />
        </div>
        {hits.map((h, i) => <HitOverlay key={`h${h.id}`} hit={h} index={i} />)}
        {mascot === 'yawning' && vote === 'coffee' && (
          <span data-slot="coffee" aria-hidden className="pointer-events-none absolute -right-3 -bottom-2 z-10 size-[55%]">
            {still ? <NotoEmoji emoji="☕" className="size-full" /> : <LottieEmoji emoji="☕" loop className="size-full" />}
          </span>
        )}
        {smoke && <Smoke />}
        {isHost && <Crown aria-label={t('room.host')} className="absolute -top-1 -right-1 size-5 rounded-full bg-primary p-1 text-primary-foreground" />}
        {p.role === 'observer' && <Eye aria-label={t('room.status.observer')} className="absolute -right-1 -bottom-1 size-5 rounded-full bg-muted p-1" />}
        {showCard && !cardOffset && <div className="absolute -right-3 -bottom-1 z-10 h-[34px] w-6">{card}</div>}
        </Avatar>,
      )}
      {showCard && cardOffset && (
        <div className="absolute top-1/2 left-1/2 z-10 h-12 w-[34px]" style={{ transform: `translate(calc(-50% + ${cardOffset.x}px), calc(-50% + ${cardOffset.y}px))` }}>{card}</div>
      )}
      <div className={`max-w-full truncate rounded-full bg-muted font-semibold ${dense ? 'px-1.5 text-[10px]' : 'px-2.5 py-0.5 text-xs'}`}>
        {isMe && dense ? t('room.you') : p.name}{isMe && !dense ? ` · ${t('room.you')}` : ''}
      </div>
      {dense
        ? <><span aria-hidden className={`absolute top-0 left-0 size-2 rounded-full ${DOT[status]}`} /><span className="sr-only">{(smoke ? t('fx.bomb.smoke') : t(`room.status.${status}`))}</span></>
        : <div className="rounded-full bg-muted px-2 text-[11px] leading-tight font-semibold text-muted-foreground">{(smoke ? t('fx.bomb.smoke') : t(`room.status.${status}`))}</div>}
      {onThrow && <button type="button" onClick={onThrow} aria-label={t('fx.throwPlane')} className="absolute top-0 left-0 size-8 rounded-full bg-muted text-sm">✈️</button>}
    </div>
  )
}
