import Matter from 'matter-js'
import { expect, test, vi } from 'vitest'
import { DEBRIS_LIFE_MS, DebrisWorld, MAX_DEBRIS } from './physics'
import { debrisFor, ITEM_KINDS } from './throws'

function setup() {
  const root = document.createElement('div')
  Object.defineProperty(root, 'clientWidth', { value: 400 })
  Object.defineProperty(root, 'clientHeight', { value: 300 })
  let now = 0
  let queued: FrameRequestCallback | null = null
  const onActive = vi.fn()
  const world = new DebrisWorld(Matter, root, {
    raf: cb => { queued = cb; return 1 },
    cancelRaf: () => { queued = null },
    now: () => now,
    onActive,
  })
  const step = (frames: number) => {
    for (let i = 0; i < frames && queued; i++) { now += 1000 / 60; const cb = queued; queued = null; cb(now) }
  }
  return { root, world, step, onActive, running: () => queued !== null }
}

test('every item except the arrow (it sticks) bursts into debris', () => {
  for (const k of ITEM_KINDS) expect(debrisFor(k, () => 0.5).length > 0).toBe(k !== 'arrow')
})

test('debris falls, lands on the floor and is removed after its life', () => {
  const { root, world, step, onActive, running } = setup()
  world.spawn(200, 100, debrisFor('roll', () => 0.5))
  expect(onActive).toHaveBeenLastCalledWith(true)
  expect(root.querySelectorAll('[data-slot=debris]')).toHaveLength(1)
  step(150)
  const el = root.querySelector<HTMLElement>('[data-slot=debris]')!
  const y = Number(/translate\([^,]+px, ([-\d.]+)px\)/.exec(el.style.transform)![1])
  expect(y).toBeGreaterThan(200)
  expect(y).toBeLessThanOrEqual(300)
  step(Math.ceil(DEBRIS_LIFE_MS / (1000 / 60)))
  expect(root.querySelectorAll('[data-slot=debris]')).toHaveLength(0)
  expect(running()).toBe(false)
  expect(onActive).toHaveBeenLastCalledWith(false)
})

test('keeps at most MAX_DEBRIS bodies, dropping the oldest', () => {
  const { root, world } = setup()
  for (let i = 0; i < 10; i++) world.spawn(200, 100, debrisFor('tomato', () => 0.5))
  expect(world.count).toBe(MAX_DEBRIS)
  expect(root.querySelectorAll('[data-slot=debris]')).toHaveLength(MAX_DEBRIS)
  world.destroy()
  expect(root.childElementCount).toBe(0)
})
