import { render, screen } from '@testing-library/react'
import i18n from '@/i18n'
import { PokerCard } from './PokerCard'

test('special card shows its i18n label', () => {
  render(<PokerCard value="bug" />)
  expect(screen.getByText(i18n.t('cards.special.bug'))).toBeInTheDocument()
})

test('number card shows value and corner indices', () => {
  const { container } = render(<PokerCard value="8" />)
  expect(container.querySelectorAll('[data-slot="card-corner"]')).toHaveLength(2)
  expect(screen.getAllByText('8').length).toBeGreaterThan(0)
})

test('face-down card does not leak its value into the DOM', () => {
  const { container } = render(<PokerCard value="13" faceUp={false} />)
  expect(container.textContent).not.toContain('13')
  const bug = render(<PokerCard value="bug" faceUp={false} />)
  expect(bug.container.textContent).not.toContain(i18n.t('cards.special.bug'))
})

test('compact hides label and corners', () => {
  const special = render(<PokerCard value="coffee" compact />)
  expect(special.container.querySelector('[data-slot="card-label"]')).toBeNull()
  const num = render(<PokerCard value="5" compact />)
  expect(num.container.querySelector('[data-slot="card-corner"]')).toBeNull()
})

test('flip animates transform only', () => {
  const { container, rerender } = render(<PokerCard value="5" faceUp={false} />)
  const flipper = container.querySelector<HTMLElement>('[data-slot="card-flipper"]')!
  expect(flipper.style.transform).toContain('rotateY(180deg)')
  expect(flipper.style.transition).toContain('transform')
  expect(flipper.style.transition).not.toContain('width')
  expect(flipper.style.width).toBe('')
  rerender(<PokerCard value="5" faceUp />)
  expect(flipper.style.transform).toContain('rotateY(0deg)')
})

test('selected draws the ring, dim lowers opacity', () => {
  const { container } = render(<PokerCard value="5" selected dim />)
  expect(container.querySelector('[data-slot="card-selected"]')).not.toBeNull()
  expect(container.firstElementChild).toHaveClass('opacity-40')
})
