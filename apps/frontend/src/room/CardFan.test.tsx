import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PRESET_SCALES, deckOf } from '@/domain'
import { CardFan } from './CardFan'

const base = { scale: PRESET_SCALES.fibonacci, enabledSpecials: ['coffee', 'bug'] as ('coffee' | 'bug')[], myVote: null }

test('renders exactly the scale plus enabled specials', () => {
  render(<CardFan {...base} send={vi.fn()} />)
  expect(screen.getAllByRole('button')).toHaveLength(deckOf(base.scale, base.enabledSpecials).length)
  expect(screen.getAllByRole('button')).toHaveLength(9)
})

test('click votes and clicking the selected card clears the vote', async () => {
  const send = vi.fn()
  const { rerender } = render(<CardFan {...base} send={send} />)
  await userEvent.click(screen.getByRole('button', { name: '5' }))
  expect(send).toHaveBeenLastCalledWith({ type: 'vote', cardId: '5' })
  rerender(<CardFan {...base} myVote="5" send={send} />)
  await userEvent.click(screen.getByRole('button', { name: '5' }))
  expect(send).toHaveBeenLastCalledWith({ type: 'vote', cardId: null })
})

test('observers get no fan and no keyboard voting', async () => {
  const send = vi.fn()
  render(<CardFan {...base} observer send={send} />)
  expect(screen.queryAllByRole('button')).toHaveLength(0)
  await userEvent.keyboard('1')
  expect(send).not.toHaveBeenCalled()
})

test('keys 1-9 pick the matching card', async () => {
  const send = vi.fn()
  render(<CardFan {...base} send={send} />)
  await userEvent.keyboard('4')
  expect(send).toHaveBeenLastCalledWith({ type: 'vote', cardId: '5' })
})
