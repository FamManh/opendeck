import { act, render, screen } from '@testing-library/react'
import { useRoomStore } from '@/store/roomStore'
import { ReconnectBanner } from './ReconnectBanner'

test('banner shows while reconnecting and hides on a fresh online connection', () => {
  render(<ReconnectBanner />)
  expect(screen.queryByRole('alert')).toBeNull()
  act(() => useRoomStore.setState({ connection: 'reconnecting' }))
  expect(screen.getByRole('alert')).toBeInTheDocument()
  act(() => useRoomStore.setState({ connection: 'online' }))
  expect(screen.queryByRole('alert')).toBeNull()
})
