import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { PokerCard } from '@/components/game/PokerCard'
import { deckOf, isSpecialId, type Scale, type SpecialId } from '@/domain'
import { useElementSize } from '@/lib/useElementSize'
import { useIsMobile } from '@/lib/useIsMobile'
import type { ClientCommand } from '@/store/roomStore'

export interface CardFanProps {
  scale: Scale
  enabledSpecials: readonly SpecialId[]
  myVote: string | null
  observer?: boolean
  send: (cmd: ClientCommand) => unknown
}

const CARD_W = 80
const DRAG_START_PX = 8
/** Dragging a card this far up counts as playing it on the table. */
export const DROP_DISTANCE_PX = 60
export const isDrop = (dy: number) => dy <= -DROP_DISTANCE_PX

/** How far apart cards sit so the whole deck fits the row; the rest overlaps. */
export function fanStep(count: number, width: number): number {
  if (count < 2 || width <= 0) return CARD_W - 8
  return Math.min(CARD_W - 8, (width - CARD_W - 32) / (count - 1))
}

/** Below this spacing the fan hides too much of each card (portrait tablets): fall back to a scrolling row. */
export const MIN_FAN_STEP = 40

interface Drag { id: string; startX: number; startY: number; dx: number; dy: number; moved: boolean }

export function CardFan({ scale, enabledSpecials, myVote, observer = false, send }: CardFanProps) {
  const { t } = useTranslation()
  const mobile = useIsMobile()
  const { ref, size } = useElementSize<HTMLDivElement>({ w: 0, h: 0 })
  const [drag, setDrag] = useState<Drag | null>(null)
  const justDragged = useRef(false)
  const deck = deckOf(scale, enabledSpecials)
  const fit = fanStep(deck.length, size.w)
  // `row`: cards side by side in a horizontal scroller (phones, or a column too narrow for a readable fan).
  const row = mobile || (size.w > 0 && fit < MIN_FAN_STEP)

  const pick = (cardId: string) => {
    if (justDragged.current) { justDragged.current = false; return }
    void send({ type: 'vote', cardId: cardId === myVote ? null : cardId })
  }

  useEffect(() => {
    if (observer) return
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const el = e.target as HTMLElement | null
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return
      if (!/^[1-9]$/.test(e.key)) return
      const card = deck[Number(e.key) - 1]
      if (card) void send({ type: 'vote', cardId: card.id === myVote ? null : card.id })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const onDown = (e: PointerEvent<HTMLButtonElement>, id: string) => {
    if (e.button !== 0) return
    setDrag({ id, startX: e.clientX, startY: e.clientY, dx: 0, dy: 0, moved: false })
  }
  const onMove = (e: PointerEvent<HTMLButtonElement>) => {
    if (!drag) return
    const dx = e.clientX - drag.startX
    const dy = e.clientY - drag.startY
    // In a scrolling row a sideways swipe scrolls; only an upward move picks the card up.
    const moved = drag.moved || (row ? -dy > DRAG_START_PX : Math.hypot(dx, dy) > DRAG_START_PX)
    if (moved && !drag.moved) e.currentTarget.setPointerCapture?.(e.pointerId)
    setDrag({ ...drag, dx, dy, moved })
  }
  const onUp = (e: PointerEvent<HTMLButtonElement>) => {
    if (!drag) return
    const dy = e.clientY - drag.startY
    if (drag.moved) {
      justDragged.current = true
      if (isDrop(dy) && drag.id !== myVote) void send({ type: 'vote', cardId: drag.id })
    }
    setDrag(null)
  }

  if (observer) return null
  const mid = (deck.length - 1) / 2
  const step = row ? CARD_W - 8 : fit
  return (
    <div
      ref={ref}
      data-slot="card-fan"
      role="group"
      aria-label={t('room.fanLabel')}
      className={`flex items-end [&::-webkit-scrollbar]:hidden ${row ? 'justify-start overflow-x-auto px-5 pt-4 pb-3' : 'justify-center px-4 pt-12 pb-2'}`}
    >
      {deck.map((c, i) => {
        const selected = c.id === myVote
        const label = isSpecialId(c.id) ? t(`cards.special.${c.id}`) : c.label
        const off = i - mid
        const dragging = drag?.id === c.id && drag.moved
        const lift = row ? (selected ? -6 : 0) : (selected ? -34 : 0) + (off * off - mid * mid) * 0.5
        const turn = row || selected ? 0 : off * 2.5
        return (
          <button
            key={c.id}
            type="button"
            aria-label={label}
            aria-pressed={selected}
            onClick={() => pick(c.id)}
            onPointerDown={e => onDown(e, c.id)}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={() => setDrag(null)}
            style={{
              marginLeft: i === 0 ? 0 : step - CARD_W,
              zIndex: dragging ? 30 : selected ? 20 : undefined,
              transform: dragging ? `translate(${drag.dx}px, ${drag.dy}px) scale(1.05)` : `translateY(${lift}px) rotate(${turn}deg)`,
              touchAction: row ? 'pan-x' : 'none',
            }}
            className={`relative h-[114px] w-20 flex-none cursor-grab select-none focus-visible:outline-2 focus-visible:outline-ring ${dragging ? '' : `transition-transform duration-200 ${row ? '' : 'hover:-translate-y-2.5'}`}`}
          >
            <PokerCard value={c.id} selected={selected} dim={myVote !== null && !selected} />
          </button>
        )
      })}
    </div>
  )
}
