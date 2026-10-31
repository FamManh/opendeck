import { render, screen } from '@testing-library/react'
import { Wheel, wheelAngle } from './Wheel'

test('final angle lands on the chosen side', () => {
  expect(wheelAngle({ chosen: 'high', pid: 'a', turns: 3 })).toBe(1080)
  expect(wheelAngle({ chosen: 'low', pid: 'a', turns: 3 })).toBe(1260)
})

test('only the host sees the spin button, and it triggers onSpin', () => {
  const onSpin = vi.fn()
  const { rerender } = render(<Wheel spin={null} nameOf={() => 'A'} isHost={false} onSpin={onSpin} />)
  expect(screen.queryByRole('button')).toBeNull()
  rerender(<Wheel spin={null} nameOf={() => 'A'} isHost onSpin={onSpin} />)
  screen.getByRole('button').click()
  expect(onSpin).toHaveBeenCalled()
})
