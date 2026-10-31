import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Item, Outcome } from '@/domain'
import { TaskPanel } from './TaskPanel'

const item = (n: number, status: Item['status']): Item => ({ id: `i${n}`, source: 'manual', externalRef: null, title: `Task ${n}`, description: '', status })
const items = [item(1, 'done'), item(2, 'pending'), item(3, 'pending')]
const outcomes: Outcome[] = [{ itemId: 'i1', value: '8', note: '', decidedBy: 'u:1', decidedAt: 0, rounds: 1 }]

test('shows done/total progress and the locked score', () => {
  render(<TaskPanel items={items} outcomes={outcomes} currentItemId={null} isHost={false} onStart={vi.fn()} />)
  expect(screen.getByText('1', { selector: '[data-slot=progress-text]' })).toBeInTheDocument()
  expect(screen.getByText('/3')).toBeInTheDocument()
  expect(screen.getByText('8')).toBeInTheDocument()
})

test('host can start a pending task; non-host cannot', async () => {
  const onStart = vi.fn()
  const { rerender } = render(<TaskPanel items={items} outcomes={outcomes} currentItemId="i2" isHost onStart={onStart} />)
  const starts = screen.getAllByRole('button', { name: /bắt đầu/i })
  expect(starts).toHaveLength(1)
  await userEvent.click(starts[0]!)
  expect(onStart).toHaveBeenCalledWith('i3')
  rerender(<TaskPanel items={items} outcomes={outcomes} currentItemId="i2" isHost={false} onStart={onStart} />)
  expect(screen.queryAllByRole('button')).toHaveLength(0)
})

test('a task with past rounds can show them; edit and delete stay away from tasks that already have rounds', async () => {
  const round = { itemId: 'i2', number: 1, status: 'revealed', votes: { a: '3' }, reasons: { a: 'Nhiều case' }, deadline: null, stats: { distribution: [{ card: { id: '3', label: '3', numeric: 3, special: false }, count: 1 }] } } as never
  const onDelete = vi.fn()
  render(<TaskPanel items={items} outcomes={outcomes} currentItemId={null} isHost onStart={vi.fn()} onEdit={vi.fn()} onDelete={onDelete} history={[round]} participants={{ a: { name: 'An' } as never }} />)
  expect(screen.getAllByRole('button', { name: /^Xóa/ })).toHaveLength(1)
  await userEvent.click(screen.getByRole('button', { name: /Xem các vòng/ }))
  expect(screen.getByText(/Nhiều case/)).toBeInTheDocument()
})

test('the summary link appears once a task is done', () => {
  const { rerender } = render(<TaskPanel items={items} outcomes={outcomes} currentItemId={null} isHost={false} onStart={vi.fn()} onSummary={vi.fn()} />)
  expect(screen.getByRole('button', { name: 'Xem tổng kết' })).toBeInTheDocument()
  rerender(<TaskPanel items={[item(2, 'pending')]} outcomes={[]} currentItemId={null} isHost={false} onStart={vi.fn()} onSummary={vi.fn()} />)
  expect(screen.queryByRole('button', { name: 'Xem tổng kết' })).toBeNull()
})
