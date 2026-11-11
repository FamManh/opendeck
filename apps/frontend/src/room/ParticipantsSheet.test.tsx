import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PRESET_SCALES, createRoom, type Participant, type PublicRoomState } from '@/domain'
import { ParticipantsSheet } from './ParticipantsSheet'

const person = (id: string, name: string, over: Partial<Participant> = {}): Participant => ({
  id, userId: null, name, avatar: 'cat', role: 'voter', joinedAt: 1, online: true, offlineSince: null, ...over,
})

function setup(isHost: boolean) {
  const base = createRoom({ id: 'r', now: 0, scale: PRESET_SCALES.fibonacci, owner: { id: 'u:1', userId: '1', name: 'Manh', avatar: 'cat', role: 'voter' } })
  const state = { ...base, current: null, participants: { ...base.participants, 'g:1': person('g:1', 'dmeo', { online: false, offlineSince: 5 }) } } as unknown as PublicRoomState
  const send = vi.fn().mockResolvedValue(undefined)
  const me = isHost ? state.participants['u:1']! : state.participants['g:1']!
  render(<ParticipantsSheet state={state} me={me} isHost={isHost} send={send} />)
  return { send }
}

test('host acts on someone through the ⋯ menu; kick asks first', async () => {
  const user = userEvent.setup()
  const { send } = setup(true)
  await user.click(screen.getByRole('button', { name: /Danh sách thành viên|Members/i }))
  expect(screen.getAllByRole('button', { name: /dmeo/ })).toHaveLength(1)
  await user.click(screen.getByRole('button', { name: /dmeo/ }))
  expect(await screen.findByRole('menuitem', { name: /host kế nhiệm|next host/i })).toHaveAttribute('data-disabled')
  await user.click(screen.getByRole('menuitem', { name: /Mời ra khỏi phòng|Remove from room/i }))
  expect(send).not.toHaveBeenCalled()
  expect(screen.getByRole('checkbox', { name: /Chặn|rejoin/i })).not.toBeChecked()
  expect(screen.getByText(/vẫn vào lại được|can still come back/i)).toBeInTheDocument()
  await user.click(await screen.findByRole('button', { name: /^(Mời ra|Remove)$/ }))
  expect(send).toHaveBeenCalledWith({ type: 'kick', target: 'g:1', ban: false })
})

test('ticking the box bans; it is unticked again the next time', async () => {
  const user = userEvent.setup()
  const { send } = setup(true)
  await user.click(screen.getByRole('button', { name: /Danh sách thành viên|Members/i }))
  const kick = async () => {
    await user.click(screen.getByRole('button', { name: /dmeo/ }))
    await user.click(await screen.findByRole('menuitem', { name: /Mời ra khỏi phòng|Remove from room/i }))
  }
  await kick()
  await user.click(screen.getByText(/Chặn không cho vào lại|Don't let them rejoin/i))
  expect(screen.getByRole('checkbox')).toBeChecked()
  expect(screen.getByText(/không vào lại được|won't be able to rejoin/i)).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: /^(Mời ra và chặn|Remove and ban)$/ }))
  expect(send).toHaveBeenCalledWith({ type: 'kick', target: 'g:1', ban: true })
  await kick()
  expect(screen.getByRole('checkbox')).not.toBeChecked()
})

test('non-hosts get no ⋯ menu but can still leave', async () => {
  const user = userEvent.setup()
  setup(false)
  await user.click(screen.getByRole('button', { name: /Danh sách thành viên|Members/i }))
  expect(screen.queryByRole('button', { name: /Thao tác|Actions/ })).toBeNull()
  expect(screen.getByRole('button', { name: /Rời phòng|Leave room/ })).toBeInTheDocument()
})
