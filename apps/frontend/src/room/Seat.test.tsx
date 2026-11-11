import { vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { Participant } from '@/domain'
import { Seat } from './Seat'

const p = (over: Partial<Participant> = {}): Participant => ({
  id: 'g:1', userId: null, name: 'Bao', avatar: 'cat', role: 'voter', joinedAt: 0, online: true, offlineSince: null, ...over,
})

test('voted seat shows a face-down card and never the value before reveal', () => {
  const { container } = render(<Seat participant={p()} voted vote="8" revealed={false} />)
  expect(container.querySelector('[data-slot=seat]')).toHaveAttribute('data-status', 'voted')
  expect(container.querySelector('[data-slot=poker-card]')).toHaveAttribute('data-face', 'down')
  expect(screen.queryByText('8')).toBeNull()
})

test('revealed seat shows the card face', () => {
  render(<Seat participant={p()} voted vote="8" revealed />)
  expect(screen.getAllByText('8').length).toBeGreaterThan(0)
})

test('thinking seat has no card', () => {
  const { container } = render(<Seat participant={p()} voted={false} vote={null} revealed={false} />)
  expect(container.querySelector('[data-slot=seat]')).toHaveAttribute('data-status', 'thinking')
  expect(container.querySelector('[data-slot=poker-card]')).toBeNull()
})

test('offline seat uses the away mascot and is dimmed to 45%', () => {
  const { container } = render(<Seat participant={p({ online: false })} voted={false} vote={null} revealed={false} />)
  const seat = container.querySelector('[data-slot=seat]')!
  expect(seat).toHaveAttribute('data-status', 'offline')
  expect(seat.className).toContain('opacity-45')
  expect(container.querySelector('[data-state=away]')).not.toBeNull()
})

test('a throwable seat opens a tray and sends the picked item', async () => {
  const user = (await import('@testing-library/user-event')).default.setup()
  const onThrowItem = vi.fn()
  render(<Seat participant={p()} voted={false} vote={null} revealed={false} onThrowItem={onThrowItem} />)
  await user.click(screen.getByRole('button', { name: /Bao/ }))
  await user.click(await screen.findByRole('button', { name: /tomato|cà chua/i }))
  expect(onThrowItem).toHaveBeenCalledWith('tomato')
})

test('a hit squashes the mascot and splats a tomato on it', () => {
  const { container } = render(<Seat participant={p()} voted={false} vote={null} revealed={false} hits={[{ id: 1, kind: 'tomato', level: 'full' }]} />)
  expect(container.querySelector('.animate-pp-squash')).not.toBeNull()
  expect(container.querySelector('[data-slot=splat]')).not.toBeNull()
})

test('at minimal level a hit shows no motion', () => {
  const { container } = render(<Seat participant={p()} voted={false} vote={null} revealed={false} hits={[{ id: 1, kind: 'heart', level: 'minimal' }]} />)
  expect(container.querySelector('.animate-pp-love')).toBeNull()
  expect(container.querySelector('[data-slot=hit-badge]')?.className).not.toContain('animate-')
})

test('an arrow sticks in the seat, a bomb explodes and leaves soot, poop brings a fly', () => {
  const seat = (kind: 'arrow' | 'bomb' | 'poop') =>
    render(<Seat participant={p()} voted={false} vote={null} revealed={false} hits={[{ id: 1, kind, level: 'full' }]} />).container
  expect(seat('arrow').querySelector('[data-slot=stuck-arrow]')).not.toBeNull()
  const bomb = seat('bomb')
  expect(bomb.querySelector('[data-slot=boom]')).not.toBeNull()
  expect(bomb.querySelector('[data-slot=splat]')).not.toBeNull()
  expect(seat('poop').querySelector('[data-slot=hit-badge]')).not.toBeNull()
})

test('several hits stack on one seat, each in its own spot', () => {
  const { container } = render(<Seat participant={p()} voted={false} vote={null} revealed={false} hits={[
    { id: 1, kind: 'tomato', level: 'full' }, { id: 2, kind: 'arrow', level: 'full' }, { id: 3, kind: 'arrow', level: 'full' },
  ]} />)
  const hits = [...container.querySelectorAll<HTMLElement>('[data-slot=hit]')]
  expect(hits.map(h => h.dataset.kind)).toEqual(['tomato', 'arrow', 'arrow'])
  expect(new Set(hits.map(h => h.style.transform)).size).toBe(3)
  expect(container.querySelectorAll('[data-slot=stuck-arrow]')).toHaveLength(2)
})

test('bomb smoke covers the seat and says they must explain', () => {
  const { container } = render(<Seat participant={p()} voted vote="13" revealed smoke />)
  expect(container.querySelector('[data-slot=smoke]')).not.toBeNull()
  expect(screen.getByText('Chờ giải thích')).toBeInTheDocument()
})

test('a yawning ☕ voter holds a steaming cup', () => {
  const { container } = render(<Seat participant={p()} voted vote="coffee" revealed mascot="yawning" still />)
  expect(container.querySelector('[data-slot=coffee]')).not.toBeNull()
  expect(container.querySelector('[data-state=yawning]')).not.toBeNull()
})
