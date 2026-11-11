/** Fun items a voter can throw at anyone in the room, offline included (server mirror: `ITEM_KINDS` in `fx.service.ts`). */
export const ITEM_KINDS = ['tomato', 'poop', 'roll', 'arrow', 'bomb', 'heart'] as const
export type ItemKind = (typeof ITEM_KINDS)[number]
/** Wake-up nudges, only at a voter who has not picked a card yet. */
export type NudgeKind = 'paper' | 'plane'
export type ThrowKind = ItemKind | NudgeKind

export const isItemKind = (k: unknown): k is ItemKind => ITEM_KINDS.includes(k as ItemKind)

export const ITEM_EMOJI: Record<ItemKind, string> = { tomato: '🍅', poop: '💩', roll: '🧻', arrow: '🏹', bomb: '💣', heart: '❤️' }

/** Same limit as the server (`ITEM_MAX` per `ITEM_WINDOW_MS`, per thrower). */
export const ITEM_MAX = 5
export const ITEM_WINDOW_MS = 3000

/** Time in the air before the item lands on the target. */
export const FLIGHT_MS = 650
/** How long each hit stays on the target (squash, splat, stuck arrow…). */
export const HIT_MS = 2000

/** Hits kept per seat at once; older ones drop off early when someone is being pelted. */
export const MAX_HITS_PER_SEAT = 6

/** Where a stacked hit sits relative to the face, so several splats/arrows don't land on the same spot. The first is centred. */
export function hitJitter(index: number, id: number): { x: number; y: number; rot: number } {
  if (index === 0) return { x: 0, y: 0, rot: 0 }
  const r = (n: number) => ((id * n) % 97) / 97 // cheap deterministic 0..1 per hit
  return { x: Math.round((r(37) - 0.5) * 50), y: Math.round((r(59) - 0.5) * 40), rot: Math.round((r(71) - 0.5) * 70) }
}

/** Debris that falls out of a hit; `emoji` bodies draw as Noto artwork, the rest as coloured dots. */
export interface DebrisSpec { emoji?: string; color?: string; r: number; bounce: number; vx: number; vy: number; spin: number }

/** Pure: what bursts out of a hit. `rand` is injectable so tests are deterministic. */
export function debrisFor(kind: ItemKind, rand: () => number = Math.random): DebrisSpec[] {
  const side = () => (rand() < 0.5 ? -1 : 1)
  switch (kind) {
    case 'tomato':
      return [
        { emoji: '🍅', r: 15, bounce: 0.25, vx: side() * (1.5 + rand() * 2), vy: -3 - rand() * 2, spin: (rand() - 0.5) * 0.3 },
        ...Array.from({ length: 5 }, () => ({ color: '#e5383b', r: 3 + rand() * 3, bounce: 0.1, vx: (rand() - 0.5) * 9, vy: -2 - rand() * 5, spin: 0 })),
      ]
    case 'poop':
      return [
        { emoji: '💩', r: 15, bounce: 0.45, vx: side() * (1.5 + rand() * 2), vy: -4 - rand() * 2, spin: (rand() - 0.5) * 0.3 },
        ...Array.from({ length: 4 }, () => ({ color: '#7b4a2a', r: 3 + rand() * 3, bounce: 0.1, vx: (rand() - 0.5) * 8, vy: -2 - rand() * 4, spin: 0 })),
      ]
    case 'arrow':
      // It sticks in the target; nothing falls off.
      return []
    case 'bomb':
      return [
        ...Array.from({ length: 10 }, (_, i) => {
          const a = (i / 10) * Math.PI * 2 + rand() * 0.4
          const v = 7 + rand() * 5
          return { color: i % 3 === 0 ? '#ff9f1c' : '#3a3a3a', r: 2.5 + rand() * 3.5, bounce: 0.3, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 3, spin: 0 }
        }),
      ]
    case 'roll':
      return [{ emoji: '🧻', r: 15, bounce: 0.75, vx: side() * (3 + rand() * 3), vy: -5 - rand() * 3, spin: side() * (0.2 + rand() * 0.2) }]
    case 'heart':
      return Array.from({ length: 5 }, (_, i) => ({
        emoji: '❤️', r: 8 + rand() * 3, bounce: 0.4, vx: (i - 2) * 1.6 + (rand() - 0.5), vy: -6 - rand() * 3, spin: (rand() - 0.5) * 0.2,
      }))
  }
}
