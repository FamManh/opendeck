import { type Card, type Scale, SPECIAL_CARDS } from './deck'
import { DomainError } from './errors'

export type ConsensusLevel = 'absolute' | 'high' | 'medium' | 'low' | 'unknown'

export interface RoundStats {
  total: number
  distribution: { card: Card; count: number }[]
  min: Card | null
  max: Card | null
  spreadSteps: number
  needsDiscussion: boolean
  consensus: number
  consensusLevel: ConsensusLevel
  average: number | null
  nearestCard: Card | null
  modes: Card[]
}

export function computeRoundStats(scale: Scale, cardIds: readonly string[]): RoundStats {
  const regularIndex = new Map(scale.cards.map((c, i) => [c.id, i]))
  const specialIndex = new Map(SPECIAL_CARDS.map((c, i) => [c.id, i]))
  const regularCounts = scale.cards.map(() => 0)
  const specialCounts = SPECIAL_CARDS.map(() => 0)

  for (const id of cardIds) {
    const r = regularIndex.get(id)
    if (r !== undefined) { regularCounts[r] = (regularCounts[r] ?? 0) + 1; continue }
    const sp = specialIndex.get(id)
    if (sp === undefined) throw new DomainError('UNKNOWN_CARD')
    specialCounts[sp] = (specialCounts[sp] ?? 0) + 1
  }

  const distribution = [
    ...scale.cards.map((card, i) => ({ card, count: regularCounts[i] ?? 0 })),
    ...SPECIAL_CARDS.map((card, i) => ({ card, count: specialCounts[i] ?? 0 })),
  ].filter(d => d.count > 0)

  const regularTotal = regularCounts.reduce((a, b) => a + b, 0)
  const usedIdx = regularCounts.flatMap((n, i) => (n > 0 ? [i] : []))
  const minIdx = usedIdx[0]
  const maxIdx = usedIdx.at(-1)
  const spreadSteps = minIdx !== undefined && maxIdx !== undefined ? maxIdx - minIdx : 0

  const top = Math.max(0, ...regularCounts)
  const modes = top === 0 ? [] : scale.cards.filter((_, i) => regularCounts[i] === top)

  let average: number | null = null
  let nearestCard: Card | null = null
  if (scale.kind === 'numeric' && regularTotal > 0) {
    const avg = scale.cards.reduce((sum, c, i) => sum + (c.numeric ?? 0) * (regularCounts[i] ?? 0), 0) / regularTotal
    average = avg
    for (const c of scale.cards) {
      if (nearestCard === null) { nearestCard = c; continue }
      const d = Math.abs((c.numeric ?? 0) - avg)
      const best = Math.abs((nearestCard.numeric ?? 0) - avg)
      if (d < best || (d === best && (c.numeric ?? 0) > (nearestCard.numeric ?? 0))) nearestCard = c
    }
  }

  return {
    total: cardIds.length,
    distribution,
    min: minIdx === undefined ? null : scale.cards[minIdx] ?? null,
    max: maxIdx === undefined ? null : scale.cards[maxIdx] ?? null,
    spreadSteps,
    needsDiscussion: spreadSteps >= 2,
    consensus: regularTotal === 0 ? 0 : top / regularTotal,
    consensusLevel: consensusLevelOf(regularTotal, spreadSteps),
    average,
    nearestCard,
    modes,
  }
}

function consensusLevelOf(regularTotal: number, spreadSteps: number): ConsensusLevel {
  if (regularTotal === 0) return 'unknown'
  if (spreadSteps === 0) return 'absolute'
  if (spreadSteps === 1) return 'high'
  if (spreadSteps === 2) return 'medium'
  return 'low'
}
