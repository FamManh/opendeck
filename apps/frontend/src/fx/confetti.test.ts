import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { ConfettiCanvas } from './confetti'

let now = 0
let queue: FrameRequestCallback[] = []

beforeEach(() => {
  now = 0
  queue = []
  vi.spyOn(performance, 'now').mockImplementation(() => now)
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { queue.push(cb); return queue.length })
  vi.stubGlobal('cancelAnimationFrame', () => { queue = [] })
})
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

function frame(advance: number) {
  now += advance
  const cbs = queue
  queue = []
  cbs.forEach(cb => cb(now))
}

const canvas = () => {
  const c = document.createElement('canvas')
  c.width = 400
  c.height = 300
  return c
}

test('burst spawns exactly count particles', () => {
  const c = new ConfettiCanvas(canvas(), { count: 38 })
  c.burst()
  expect(c.active).toBe(38)
})

test('after 2000ms no particles and no pending frame', () => {
  const c = new ConfettiCanvas(canvas(), { count: 38 })
  c.burst()
  frame(1000)
  expect(c.active).toBe(38)
  frame(1000)
  expect(c.active).toBe(0)
  expect(queue).toHaveLength(0)
})

test('second burst never exceeds the cap', () => {
  const c = new ConfettiCanvas(canvas(), { count: 19 })
  c.burst()
  c.burst()
  expect(c.active).toBe(19)
})

test('destroy clears particles and frames', () => {
  const c = new ConfettiCanvas(canvas(), { count: 10 })
  c.burst()
  c.destroy()
  expect(c.active).toBe(0)
  expect(queue).toHaveLength(0)
})
