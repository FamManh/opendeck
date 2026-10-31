import { expect, test, vi } from 'vitest'
import { FpsGovernor } from './governor'

function setup(frameMs: number, opts: { visible?: () => boolean; spike?: { at: number; ms: number } } = {}) {
  let t = 0
  let queue: FrameRequestCallback[] = []
  const onCap = vi.fn()
  const g = new FpsGovernor({
    raf: cb => { queue.push(cb); return queue.length },
    now: () => t,
    isVisible: opts.visible ?? (() => true),
    onCap,
  })
  const run = (ms: number, step = frameMs) => {
    const end = t + ms
    let i = 0
    while (t < end && queue.length) {
      const cb = queue.shift()!
      t += opts.spike && i++ === opts.spike.at ? opts.spike.ms : step
      cb(t)
    }
  }
  return { g, run, onCap, pending: () => queue.length }
}

test('30ms frames for 3s while full => medium', () => {
  const { g, run, onCap } = setup(30)
  g.startSampling()
  run(3500)
  expect(onCap).toHaveBeenCalledWith('medium')
})

test('16ms frames => no downgrade', () => {
  const { g, run, onCap } = setup(16)
  g.startSampling()
  run(6000)
  expect(onCap).not.toHaveBeenCalled()
})

test('hidden tab with slow frames does not downgrade', () => {
  const { g, run, onCap } = setup(200, { visible: () => false })
  g.startSampling()
  run(6000)
  expect(onCap).not.toHaveBeenCalled()
})

test('a single 500ms hitch does not downgrade', () => {
  const { g, run, onCap } = setup(16, { spike: { at: 40, ms: 500 } })
  g.startSampling()
  run(6000)
  expect(onCap).not.toHaveBeenCalled()
})

test('after medium, ~20fps => minimal, never raises', () => {
  const { g, run, onCap } = setup(30)
  g.startSampling()
  run(3500)
  expect(onCap).toHaveBeenLastCalledWith('medium')
  run(4000, 50)
  expect(onCap).toHaveBeenLastCalledWith('minimal')
  run(6000, 16)
  expect(onCap).toHaveBeenCalledTimes(2)
})

test('stopSampling leaves no pending frame after the next tick', () => {
  const { g, run, pending } = setup(16)
  g.startSampling()
  run(100)
  g.stopSampling()
  run(100)
  expect(pending()).toBe(0)
})
