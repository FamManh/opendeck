import vi from './vi.json'
import en from './en.json'
import { SPECIAL_IDS, PRESET_SCALES } from '../domain'

function keys(obj: object, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === 'object' ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`]).sort()
}

test('vi and en have identical key sets', () => {
  expect(keys(en)).toEqual(keys(vi))
})
test.each([['vi', vi], ['en', en]] as const)('%s translates every special card and preset scale', (_, res) => {
  for (const id of SPECIAL_IDS) expect(res.cards.special[id]).toBeTruthy()
  for (const id of Object.keys(PRESET_SCALES)) expect(res.scales[id as keyof typeof res.scales]).toBeTruthy()
})
