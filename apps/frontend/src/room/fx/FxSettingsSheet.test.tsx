import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FX_STORAGE_KEY } from '@/fx/prefs'
import { FxSettingsSheet } from './FxSettingsSheet'

async function open() {
  const user = userEvent.setup()
  render(<FxSettingsSheet />)
  await user.click(screen.getByRole('button', { name: /hiệu ứng/i }))
  return user
}

test('shows the 3 levels, both toggles and the local-only note', async () => {
  await open()
  for (const name of ['Đầy đủ', 'Vừa phải', 'Tối giản']) expect(screen.getByRole('radio', { name: new RegExp(name) })).toBeInTheDocument()
  expect(screen.getByRole('switch', { name: 'Âm thanh' })).toBeInTheDocument()
  expect(screen.getByRole('switch', { name: /giảm chuyển động/i })).toBeInTheDocument()
  expect(screen.getByText('Chỉ áp dụng trên máy của bạn.')).toBeInTheDocument()
})

test('choosing Tối giản saves the level on this device', async () => {
  const user = await open()
  await user.click(screen.getByRole('radio', { name: /Tối giản/ }))
  await act(async () => {})
  expect(JSON.parse(localStorage.getItem(FX_STORAGE_KEY)!).level).toBe('minimal')
})

test('sound toggle persists', async () => {
  const user = await open()
  await user.click(screen.getByRole('switch', { name: 'Âm thanh' }))
  expect(JSON.parse(localStorage.getItem(FX_STORAGE_KEY)!).sound).toBe(false)
})
