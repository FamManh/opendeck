import { AttemptLimiter } from './attempt-limiter'

function setup() {
  let t = 0
  const lim = new AttemptLimiter(5, 15 * 60_000, () => t)
  return { lim, advance: (ms: number) => { t += ms } }
}

test('blocks after max failures within the window', () => {
  const { lim } = setup()
  for (let i = 0; i < 4; i++) lim.recordFailure('a|1')
  expect(lim.isBlocked('a|1')).toBe(false)
  lim.recordFailure('a|1')
  expect(lim.isBlocked('a|1')).toBe(true)
})

test('keys are independent', () => {
  const { lim } = setup()
  for (let i = 0; i < 5; i++) lim.recordFailure('a|1')
  expect(lim.isBlocked('a|2')).toBe(false)
  expect(lim.isBlocked('b|1')).toBe(false)
})

test('sliding window: old failures expire one by one', () => {
  const { lim, advance } = setup()
  lim.recordFailure('k')                       // t=0
  advance(60_000)
  for (let i = 0; i < 4; i++) lim.recordFailure('k') // t=1m
  expect(lim.isBlocked('k')).toBe(true)
  advance(14 * 60_000 + 1)                     // t=15m+1ms → lần đầu hết hạn
  expect(lim.isBlocked('k')).toBe(false)
})

test('reset clears the key', () => {
  const { lim } = setup()
  for (let i = 0; i < 5; i++) lim.recordFailure('k')
  lim.reset('k')
  expect(lim.isBlocked('k')).toBe(false)
})
