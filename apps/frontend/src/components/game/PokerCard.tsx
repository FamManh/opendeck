import type { CSSProperties, ReactNode } from 'react'
import { Bomb, Bug, Coffee, Infinity as InfinityIcon, Puzzle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { isSpecialId, type SpecialId } from '@/domain'

export interface PokerCardProps {
  value: string
  faceUp?: boolean
  selected?: boolean
  dim?: boolean
  compact?: boolean
  instant?: boolean
  className?: string
}

const ICON = 'size-[54cqw]'

const SPECIAL_FACE: Record<SpecialId, { bg: string; fg: string; icon: ReactNode }> = {
  coffee: { bg: 'bg-special-coffee', fg: 'text-special-coffee-fg', icon: <Coffee className={ICON} strokeWidth={1.8} /> },
  question: { bg: 'bg-special-question', fg: 'text-special-question-fg', icon: <div className="text-[50cqw] leading-none">?</div> },
  bug: { bg: 'bg-special-bug', fg: 'text-special-bug-fg', icon: <Bug className={ICON} strokeWidth={1.8} /> },
  bomb: { bg: 'bg-special-bomb', fg: 'text-special-bomb-fg', icon: <Bomb className={ICON} strokeWidth={1.8} /> },
  puzzle: { bg: 'bg-special-puzzle', fg: 'text-special-puzzle-fg', icon: <Puzzle className={ICON} strokeWidth={1.8} /> },
  infinity: { bg: 'bg-special-infinity', fg: 'text-special-infinity-fg', icon: <InfinityIcon className="h-[54cqw] w-[62cqw]" strokeWidth={1.8} /> },
  shrug: { bg: 'bg-special-shrug', fg: 'text-special-shrug-fg', icon: <div className="text-[14cqw] leading-none font-medium whitespace-nowrap">{'¯\\_(ツ)_/¯'}</div> },
}

const FACE = 'absolute inset-0 [backface-visibility:hidden] [-webkit-backface-visibility:hidden] rounded-[10cqw]'

export function PokerCard({ value, faceUp = true, selected = false, dim = false, compact = false, instant = false, className }: PokerCardProps) {
  const { t } = useTranslation()
  const special = isSpecialId(value) ? SPECIAL_FACE[value] : null

  // Flipping only animates `transform`, never layout properties.
  const flipper: CSSProperties = {
    transformStyle: 'preserve-3d',
    transform: faceUp ? 'rotateY(0deg)' : 'rotateY(180deg)',
    transition: instant ? 'none' : 'transform 560ms cubic-bezier(.3,.7,.35,1.15)',
  }

  return (
    <div
      data-slot="poker-card"
      data-face={faceUp ? 'up' : 'down'}
      className={`relative size-full transition-opacity duration-300 [container-type:size] [perspective:800px] ${dim ? 'opacity-40' : ''} ${className ?? ''}`}
    >
      <div data-slot="card-flipper" className="absolute inset-0" style={flipper}>
        <div className={`${FACE} overflow-hidden border border-card-line bg-card-paper text-card-ink`}>
          {faceUp && special && (
            <div className={`absolute inset-0 flex flex-col items-center justify-center ${special.bg} ${special.fg} ${value === 'question' ? 'gap-0' : value === 'shrug' ? 'gap-[6cqw]' : 'gap-[4cqw]'}`}>
              {special.icon}
              {!compact && <div className="text-[10.5cqw] font-[650] tracking-[.01em]" data-slot="card-label">{t(`cards.special.${value}`)}</div>}
            </div>
          )}
          {faceUp && !special && (
            <>
              <div className={`absolute inset-0 flex items-center justify-center leading-none font-[650] tracking-[-0.02em] tabular-nums ${value.length > 2 ? 'text-[30cqw]' : 'text-[44cqw]'}`}>{value}</div>
              {!compact && value.length <= 2 && (
                <>
                  <div data-slot="card-corner" className="absolute top-[6cqw] left-[9cqw] text-[13cqw] leading-none font-[650] text-card-corner">{value}</div>
                  <div data-slot="card-corner" className="absolute right-[9cqw] bottom-[6cqw] rotate-180 text-[13cqw] leading-none font-[650] text-card-corner">{value}</div>
                </>
              )}
            </>
          )}
        </div>
        <div className={`${FACE} flex items-center justify-center border-2 border-card-back-line bg-card-back [transform:rotateY(180deg)]`}>
          <div className="absolute inset-[7cqw] rounded-[8cqw] border-[1.5px] [border-color:color-mix(in_oklch,var(--primary)_45%,transparent)]" />
          <div className="relative flex size-[38cqw] items-center justify-center rounded-full bg-primary">
            <svg viewBox="0 0 24 24" className="size-[24cqw]" aria-hidden="true">
              <path d="M12 2 Q12 12 22 12 Q12 12 12 22 Q12 12 2 12 Q12 12 12 2 Z" className="fill-card-back" />
            </svg>
          </div>
        </div>
      </div>
      {selected && <div data-slot="card-selected" className="pointer-events-none absolute -inset-[5px] rounded-[calc(10cqw+5px)] border-[3px] border-primary" />}
    </div>
  )
}
