export type SeatDensity = 'normal' | 'compact' | 'dense'

export const SEAT_SIZE: Record<SeatDensity, { w: number; h: number }> = {
  normal: { w: 96, h: 106 },
  compact: { w: 80, h: 82 },
  dense: { w: 56, h: 46 },
}
const CARD = { w: 34, h: 48 }
/** Room the task card takes in the middle of the table. */
const TASK = { wRatio: 0.44, wMax: 384, h: 136 }
const RING_MAX = 24

export interface SeatSpot { x: number; y: number; card: { x: number; y: number } | null }
export type SeatLayout =
  | { mode: 'ring'; density: SeatDensity; seats: SeatSpot[]; felt: { x: number; y: number; w: number; h: number } }
  | { mode: 'grid'; density: SeatDensity }

const DENSITIES: SeatDensity[] = ['normal', 'compact', 'dense']

function startDensity(n: number): number {
  if (n <= 8) return 0
  return n <= 14 ? 1 : 2
}

/** Evenly spaced by arc length, so seats do not bunch up on the short sides of a wide table. First seat at the bottom. */
function ringPoints(n: number, rx: number, ry: number): { x: number; y: number }[] {
  const samples = 720
  const pts = Array.from({ length: samples }, (_, i) => {
    const a = Math.PI / 2 + (i * 2 * Math.PI) / samples
    return { x: rx * Math.cos(a), y: ry * Math.sin(a) }
  })
  const dist = [0]
  for (let i = 1; i <= samples; i++) {
    const a = pts[i - 1]!, b = pts[i % samples]!
    dist.push(dist[i - 1]! + Math.hypot(a.x - b.x, a.y - b.y))
  }
  const total = dist[samples]!
  let j = 0
  return Array.from({ length: n }, (_, i) => {
    const want = (i * total) / n
    while (dist[j + 1]! < want) j++
    return pts[j]!
  })
}

const overlaps = (a: { x: number; y: number }, b: { x: number; y: number }, w: number, h: number) =>
  Math.abs(a.x - b.x) < w && Math.abs(a.y - b.y) < h

/** Card spot between the seat and the middle, or null when any card would land on the task or on another seat. */
function cardSpots(pts: { x: number; y: number }[], w: number, size: { w: number; h: number }): ({ x: number; y: number } | null)[] {
  const none = pts.map(() => null)
  const taskW = Math.min(w * TASK.wRatio, TASK.wMax)
  const spots = []
  for (const p of pts) {
    const len = Math.hypot(p.x, p.y) || 1
    const dx = -p.x / len, dy = -p.y / len
    const reach = Math.abs(dx) * (size.w + CARD.w) / 2 + Math.abs(dy) * (size.h + CARD.h) / 2 + 4
    const c = { x: dx * reach, y: dy * reach }
    const abs = { x: p.x + c.x, y: p.y + c.y }
    if (Math.abs(abs.x) < (taskW + CARD.w) / 2 && Math.abs(abs.y) < (TASK.h + CARD.h) / 2) return none
    if (pts.some(o => o !== p && Math.abs(abs.x - o.x) < (size.w + CARD.w) / 2 && Math.abs(abs.y - o.y) < (size.h + CARD.h) / 2)) return none
    spots.push(c)
  }
  return spots
}

/** Picks the roomiest density that fits; falls back to a plain grid rather than ever overlapping seats. */
export function seatLayout(n: number, w: number, h: number): SeatLayout {
  if (n > RING_MAX) return { mode: 'grid', density: 'dense' }
  for (const density of DENSITIES.slice(startDensity(n))) {
    const size = SEAT_SIZE[density]
    const rx = w / 2 - size.w / 2
    const ry = h / 2 - size.h / 2
    if (rx <= 0 || ry <= 0) continue
    const pts = ringPoints(n, rx, ry)
    const clash = pts.some((a, i) => pts.slice(i + 1).some(b => overlaps(a, b, size.w, size.h)))
    if (clash) continue
    const cards = density === 'dense' ? pts.map(() => null) : cardSpots(pts, w, size)
    const inset = { x: size.w * 0.55, y: size.h * 0.5 }
    return {
      mode: 'ring',
      density,
      seats: pts.map((p, i) => ({ x: w / 2 + p.x, y: h / 2 + p.y, card: cards[i] ?? null })),
      felt: { x: inset.x, y: inset.y, w: w - inset.x * 2, h: h - inset.y * 2 },
    }
  }
  return { mode: 'grid', density: 'dense' }
}
