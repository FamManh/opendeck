import { render } from '@testing-library/react'
import { MASCOT_STATES, Mascot, SPECIES } from './Mascot'

test.each(SPECIES.flatMap(sp => MASCOT_STATES.map(st => [sp, st] as const)))('renders %s / %s', (species, state) => {
  const { container } = render(<Mascot species={species} state={state} size={64} />)
  const root = container.querySelector('[data-slot="mascot"]')!
  expect(root).toHaveAttribute('data-species', species)
  expect(root).toHaveAttribute('data-state', state)
  expect(root.querySelectorAll('svg')).toHaveLength(3)
})

test('covers 8 species x 8 states (incl. dancing, yawning reactions)', () => {
  expect(SPECIES).toHaveLength(8)
  expect(MASCOT_STATES).toHaveLength(8)
})
