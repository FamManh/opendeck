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
