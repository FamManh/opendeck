import { CmdRateLimiter } from './cmd-rate-limiter'

function setup() {
  let t = 0
  return { lim: new CmdRateLimiter(() => t), advance: (ms: number) => { t += ms } }
}

test('allows 10 per second then blocks', () => {
  const { lim } = setup()
  const results = Array.from({ length: 30 }, () => lim.allow('s'))
  expect(results.filter(Boolean)).toHaveLength(10)
})

test('sockets are independent and the window slides', () => {
  const { lim, advance } = setup()
  for (let i = 0; i < 10; i++) lim.allow('a')
  expect(lim.allow('a')).toBe(false)
  expect(lim.allow('b')).toBe(true)
  advance(1001)
  expect(lim.allow('a')).toBe(true)
})
