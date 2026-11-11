import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PRESET_SCALES, computeRoundStats } from '@/domain'
import { ResultsPanel } from './ResultsPanel'

const fib = PRESET_SCALES.fibonacci
const noop = () => {}

test('numeric round: average, nearest card, min/max, consensus chip', () => {
  const stats = computeRoundStats(fib, ['3', '5', '5', '8'])
  render(<ResultsPanel stats={stats} scale={fib} isHost={false} onFinalize={noop} onRevote={noop} />)
  expect(screen.getByText('5.25')).toBeInTheDocument()
  expect(screen.getByText(/Đồng thuận: /)).toBeInTheDocument()
  expect(screen.getByText('4 phiếu')).toBeInTheDocument()
  expect(screen.getByText(/Thấp nhất/)).toBeInTheDocument()
  expect(screen.getByText('gần nhất')).toBeInTheDocument()
})

test('t-shirt round shows modes instead of an average', () => {
  const tshirt = PRESET_SCALES.tshirt
  const stats = computeRoundStats(tshirt, ['M', 'M', 'L'])
  const { container } = render(<ResultsPanel stats={stats} scale={tshirt} isHost={false} onFinalize={noop} onRevote={noop} />)
  expect(container.querySelector('[data-slot=modes]')).toHaveTextContent('M')
  expect(container.querySelector('[data-slot=average]')).toBeNull()
})

test('discussion invite names the low and high voters', () => {
  const stats = computeRoundStats(fib, ['1', '13'])
  expect(stats.needsDiscussion).toBe(true)
  render(<ResultsPanel stats={stats} scale={fib} isHost={false} discussion={{ low: ['An'], high: ['Bình'] }} onFinalize={noop} onRevote={noop} />)
  expect(screen.getByText('Mời An và Bình nói trước')).toBeInTheDocument()
})

test('host picks a card and locks; non-host sees no controls', async () => {
  const stats = computeRoundStats(fib, ['3', '5', '5', '8'])
  const onFinalize = vi.fn()
  const onRevote = vi.fn()
  const { rerender } = render(<ResultsPanel stats={stats} scale={fib} isHost onFinalize={onFinalize} onRevote={onRevote} />)
  await userEvent.click(screen.getByRole('button', { name: '8' }))
  await userEvent.click(screen.getByRole('button', { name: 'Chốt điểm' }))
  expect(onFinalize).toHaveBeenCalledWith('8')
  await userEvent.click(screen.getByRole('button', { name: 'Bỏ phiếu lại' }))
  expect(onRevote).toHaveBeenCalled()
  await userEvent.type(screen.getAllByRole('textbox')[0]!, '40')
  await userEvent.click(screen.getByRole('button', { name: 'Chốt điểm' }))
  expect(onFinalize).toHaveBeenLastCalledWith('40')
  rerender(<ResultsPanel stats={stats} scale={fib} isHost={false} onFinalize={onFinalize} onRevote={onRevote} />)
  expect(screen.queryByRole('button', { name: 'Chốt điểm' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Bỏ phiếu lại' })).toBeNull()
})

test('bomb: the host cannot lock the score until everyone explained, unless they skip', async () => {
  const user = userEvent.setup()
  const onFinalize = vi.fn()
  const stats = computeRoundStats(fib, ['1', '13'])
  const { rerender } = render(<ResultsPanel stats={stats} scale={fib} isHost onFinalize={onFinalize} onRevote={noop} bomb={{ steps: 5, waiting: ['An'] }} />)
  expect(screen.getByText(/Chờ An giải thích/)).toBeInTheDocument()
  const lock = screen.getByRole('button', { name: 'Chốt điểm' })
  expect(lock).toBeDisabled()
  await user.click(screen.getByRole('button', { name: /Bỏ qua/ }))
  expect(lock).toBeEnabled()
  rerender(<ResultsPanel stats={stats} scale={fib} isHost onFinalize={onFinalize} onRevote={noop} bomb={{ steps: 5, waiting: [] }} />)
  expect(screen.getByText(/Mọi người đã giải thích/)).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Bỏ qua/ })).toBeNull()
})
