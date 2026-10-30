import { PRESET_SCALES, SPECIAL_CARDS, SPECIAL_IDS, deckOf, createCustomScale, isSpecialId } from './deck'
import { DomainError } from './errors'

const ALL = ['coffee','question','bug','bomb','puzzle','infinity','shrug']

test('fibonacci preset', () => {
  expect(PRESET_SCALES.fibonacci.cards.map(c => c.label)).toEqual(['1','2','3','5','8','13','21'])
  expect(PRESET_SCALES.fibonacci.kind).toBe('numeric')
  expect(PRESET_SCALES.fibonacci.cards[3]).toEqual({ id: '5', label: '5', numeric: 5, special: false })
})
test('hours and days presets are numeric with fractional 0.5', () => {
  expect(PRESET_SCALES.hours.cards.map(c => c.numeric)).toEqual([0.5,1,2,4,8,16,24])
  expect(PRESET_SCALES.days.cards.map(c => c.numeric)).toEqual([0.5,1,2,3,5,8])
})
test('tshirt is ordinal with null numeric', () => {
  expect(PRESET_SCALES.tshirt.cards.map(c => c.label)).toEqual(['XS','S','M','L','XL'])
  expect(PRESET_SCALES.tshirt.kind).toBe('ordinal')
  expect(PRESET_SCALES.tshirt.cards.every(c => c.numeric === null)).toBe(true)
})
test('7 special cards in fixed order, language-neutral labels (UI translates by id)', () => {
  expect(SPECIAL_IDS).toEqual(ALL)
  expect(SPECIAL_CARDS.map(c => c.label)).toEqual(ALL)
  expect(SPECIAL_CARDS.every(c => c.special && c.numeric === null)).toBe(true)
})
test('deckOf defaults to all 7 specials at the end', () => {
  for (const s of Object.values(PRESET_SCALES)) {
    const d = deckOf(s)
    expect(d.length).toBe(s.cards.length + 7)
    expect(d.slice(-7).map(c => c.id)).toEqual(ALL)
  }
})
test('deckOf with subset keeps canonical order and dedupes', () => {
  const d = deckOf(PRESET_SCALES.fibonacci, ['shrug','coffee','coffee'])
  expect(d.slice(-2).map(c => c.id)).toEqual(['coffee','shrug'])
  expect(d.length).toBe(9)
  expect(deckOf(PRESET_SCALES.fibonacci, []).length).toBe(7)
})
test('deckOf rejects unknown special id', () => {
  expect(() => deckOf(PRESET_SCALES.fibonacci, ['pizza' as never])).toThrow('UNKNOWN_SPECIAL')
})
test('isSpecialId', () => {
  expect(isSpecialId('bug')).toBe(true)
  expect(isSpecialId('5')).toBe(false)
})
test('custom scale: kind detection and numeric parse', () => {
  const n = createCustomScale('Team', ['1','2','4','0.5'])
  expect(n.kind).toBe('numeric')
  expect(n.cards.map(c => c.numeric)).toEqual([1,2,4,0.5])
  const o = createCustomScale('Team', ['low','high'])
  expect(o.kind).toBe('ordinal')
  expect(o.cards.every(c => c.numeric === null)).toBe(true)
})
test('custom scale trims labels', () => {
  expect(createCustomScale('x', [' a ', 'b']).cards.map(c => c.id)).toEqual(['a','b'])
})
test.each([
  [['1'], 'SCALE_TOO_SMALL'],
  [['1','1'], 'SCALE_DUPLICATE'],
  [['1',' 1 '], 'SCALE_DUPLICATE'],
  [['1','  '], 'SCALE_EMPTY_LABEL'],
  [['1','coffee'], 'SCALE_RESERVED_LABEL'],
])('custom scale %j throws %s', (labels, code) => {
  try { createCustomScale('x', labels); expect.unreachable() }
  catch (e) { expect(e).toBeInstanceOf(DomainError); expect((e as DomainError).code).toBe(code) }
})
