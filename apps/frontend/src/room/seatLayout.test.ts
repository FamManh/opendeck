import { SEAT_SIZE, seatLayout } from './seatLayout'

const SIZES: [number, number][] = [[700, 440], [900, 600], [1040, 560]]

test.each(SIZES)('%i×%i: 1–24 seats stay inside the table and never overlap', (w, h) => {
  for (let n = 1; n <= 24; n++) {
    const l = seatLayout(n, w, h)
    if (l.mode !== 'ring') continue
    const size = SEAT_SIZE[l.density]
    expect(l.seats).toHaveLength(n)
    for (const s of l.seats) {
      expect(s.x - size.w / 2).toBeGreaterThanOrEqual(-0.01)
      expect(s.x + size.w / 2).toBeLessThanOrEqual(w + 0.01)
      expect(s.y - size.h / 2).toBeGreaterThanOrEqual(-0.01)
      expect(s.y + size.h / 2).toBeLessThanOrEqual(h + 0.01)
    }
    l.seats.forEach((a, i) => l.seats.slice(i + 1).forEach(b => {
      expect(Math.abs(a.x - b.x) >= size.w || Math.abs(a.y - b.y) >= size.h).toBe(true)
    }))
  }
})

test('density follows the head count', () => {
  expect(seatLayout(6, 900, 600)).toMatchObject({ mode: 'ring', density: 'normal' })
  expect(seatLayout(12, 900, 600)).toMatchObject({ mode: 'ring', density: 'compact' })
  expect(seatLayout(20, 900, 600)).toMatchObject({ mode: 'ring', density: 'dense' })
  expect(seatLayout(20, 1040, 560)).toMatchObject({ mode: 'ring', density: 'dense' })
})

test('a roomy table puts cards on the felt; dense seats keep them on the seat', () => {
  const roomy = seatLayout(4, 900, 600)
  expect(roomy.mode === 'ring' && roomy.seats.every(s => s.card !== null)).toBe(true)
  const dense = seatLayout(20, 900, 600)
  expect(dense.mode === 'ring' && dense.seats.every(s => s.card === null)).toBe(true)
})

test('more than 24 people, or a table too small, falls back to the grid', () => {
  expect(seatLayout(25, 1400, 900).mode).toBe('grid')
  expect(seatLayout(50, 1400, 900).mode).toBe('grid')
  expect(seatLayout(24, 300, 200).mode).toBe('grid')
})
