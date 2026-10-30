import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { PokerCard } from '@/components/game/PokerCard'
import { deckOf, isSpecialId, type Scale, type SpecialId } from '@/domain'
import type { ClientCommand } from '@/store/roomStore'

export interface CardFanProps {
  scale: Scale
  enabledSpecials: readonly SpecialId[]
  myVote: string | null
  observer?: boolean
  send: (cmd: ClientCommand) => unknown
}

export function CardFan({ scale, enabledSpecials, myVote, observer = false, send }: CardFanProps) {
  const { t } = useTranslation()
  const deck = deckOf(scale, enabledSpecials)

  const pick = (cardId: string) => { void send({ type: 'vote', cardId: cardId === myVote ? null : cardId }) }

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

  if (observer) return null
  const mid = (deck.length - 1) / 2
  return (
    <div data-slot="card-fan" role="group" aria-label={t('room.fanLabel')} className="flex items-end justify-start gap-0 overflow-x-auto px-6 pt-6 pb-3 md:justify-center [&::-webkit-scrollbar]:hidden">
      {deck.map((c, i) => {
        const selected = c.id === myVote
        const label = isSpecialId(c.id) ? t(`cards.special.${c.id}`) : c.label
        return (
          <button
            key={c.id}
            type="button"
            aria-label={label}
            aria-pressed={selected}
            onClick={() => pick(c.id)}
            style={{ transform: `translateY(${selected ? -18 : 0}px) rotate(${selected ? 0 : (i - mid) * 2.5}deg)` }}
            className="-mx-1 h-[114px] w-20 flex-none cursor-pointer transition-transform duration-200 hover:-translate-y-2.5 focus-visible:outline-2 focus-visible:outline-ring"
          >
            <PokerCard value={c.id} selected={selected} dim={myVote !== null && !selected} />
          </button>
        )
      })}
    </div>
  )
}
