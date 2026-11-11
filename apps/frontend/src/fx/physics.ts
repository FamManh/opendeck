import type MatterNS from 'matter-js'
import { notoStatic } from './emojis'
import type { DebrisSpec } from './throws'

type Matter = typeof MatterNS
type Body = MatterNS.Body

let loading: Promise<Matter> | null = null
let loaded: Matter | null = null

/** matter-js (~80 KB) is only fetched the first time someone opens the throw menu or gets hit at full level. */
export function loadPhysics(): Promise<Matter> {
  if (!loading) {
    loading = import('matter-js').then(m => {
      loaded = ((m as { default?: Matter }).default ?? m) as Matter
      return loaded
    })
    loading.catch(() => { loading = null })
  }
  return loading
}

/** The loaded module, or null while it is still downloading (a hit then simply has no debris). */
export const physicsReady = (): Matter | null => loaded

export const MAX_DEBRIS = 24
export const DEBRIS_LIFE_MS = 4500
const FADE_MS = 800
const WALL = 80
const STEP_MS = 1000 / 60

export interface DebrisWorldOptions {
  raf?: (cb: FrameRequestCallback) => number
  cancelRaf?: (id: number) => void
  now?: () => number
  /** True while bodies are moving (the fps governor samples only then). */
  onActive?: (active: boolean) => void
}

interface Item { body: Body; el: HTMLElement; born: number; r: number }

/**
 * Headless matter-js world: no canvas renderer, each body is a DOM node moved with `transform`
 * (effects may only animate transform and opacity). The rAF loop runs only while debris exists.
 */
export class DebrisWorld {
  private readonly engine: MatterNS.Engine
  private walls: Body[] = []
  private items: Item[] = []
  private handle: number | null = null
  private last: number | null = null
  private readonly raf: (cb: FrameRequestCallback) => number
  private readonly cancelRaf: (id: number) => void
  private readonly now: () => number

  constructor(private readonly M: Matter, private readonly root: HTMLElement, private readonly o: DebrisWorldOptions = {}) {
    this.raf = o.raf ?? (cb => requestAnimationFrame(cb))
    this.cancelRaf = o.cancelRaf ?? (id => cancelAnimationFrame(id))
    this.now = o.now ?? (() => performance.now())
    this.engine = M.Engine.create({ gravity: { x: 0, y: 1, scale: 0.0012 } })
    this.resize(root.clientWidth, root.clientHeight)
  }

  get count() { return this.items.length }

  /** Floor along the bottom of the layer and walls on both sides; no ceiling so debris can arc up. */
  resize(w: number, h: number) {
    const { Bodies, Composite } = this.M
    if (this.walls.length) Composite.remove(this.engine.world, this.walls)
    const opts = { isStatic: true, friction: 0.6 }
    this.walls = [
      Bodies.rectangle(w / 2, h + WALL / 2, w + WALL * 4, WALL, opts),
      Bodies.rectangle(-WALL / 2, h / 2, WALL, h * 4, opts),
      Bodies.rectangle(w + WALL / 2, h / 2, WALL, h * 4, opts),
    ]
    Composite.add(this.engine.world, this.walls)
  }

  spawn(x: number, y: number, specs: DebrisSpec[]) {
    const { Bodies, Body, Composite } = this.M
    const born = this.now()
    for (const s of specs) {
      const body = Bodies.circle(x + (Math.random() - 0.5) * 10, y, s.r, { restitution: s.bounce, friction: 0.08, frictionAir: 0.012 })
      Body.setVelocity(body, { x: s.vx, y: s.vy })
      Body.setAngularVelocity(body, s.spin)
      Composite.add(this.engine.world, body)
      this.items.push({ body, el: this.node(s), born, r: s.r })
    }
    while (this.items.length > MAX_DEBRIS) this.drop(this.items[0]!)
    this.paint()
    if (this.handle === null) {
      this.last = null
      this.o.onActive?.(true)
      this.handle = this.raf(this.frame)
    }
  }

  destroy() {
    if (this.handle !== null) this.cancelRaf(this.handle)
    if (this.handle !== null) this.o.onActive?.(false)
    this.handle = null
    this.items.forEach(i => i.el.remove())
    this.items = []
    this.M.Composite.clear(this.engine.world, false)
    this.M.Engine.clear(this.engine)
  }

  private node(s: DebrisSpec): HTMLElement {
    const size = `${s.r * 2}px`
    let el: HTMLElement
    if (s.emoji) {
      const img = document.createElement('img')
      img.src = notoStatic(s.emoji)
      img.alt = ''
      img.draggable = false
      el = img
    } else {
      el = document.createElement('span')
      el.style.borderRadius = '50%'
      el.style.background = s.color ?? 'currentColor'
    }
    el.dataset.slot = 'debris'
    Object.assign(el.style, { position: 'absolute', left: '0', top: '0', width: size, height: size, willChange: 'transform, opacity' })
    this.root.appendChild(el)
    return el
  }

  private drop(item: Item) {
    this.M.Composite.remove(this.engine.world, item.body)
    item.el.remove()
    this.items = this.items.filter(i => i !== item)
  }

  private paint() {
    const now = this.now()
    for (const item of [...this.items]) {
      const age = now - item.born
      if (age >= DEBRIS_LIFE_MS) { this.drop(item); continue }
      const { x, y } = item.body.position
      item.el.style.transform = `translate(${x - item.r}px, ${y - item.r}px) rotate(${item.body.angle}rad)`
      item.el.style.opacity = age > DEBRIS_LIFE_MS - FADE_MS ? String((DEBRIS_LIFE_MS - age) / FADE_MS) : '1'
    }
  }

  private frame = (t: number) => {
    this.handle = null
    // Clamp the step: after a background tab or a long frame, don't let bodies tunnel through the floor.
    const dt = this.last === null ? STEP_MS : Math.min(Math.max(t - this.last, 0), STEP_MS)
    this.last = t
    this.M.Engine.update(this.engine, dt)
    this.paint()
    if (this.items.length) this.handle = this.raf(this.frame)
    else this.o.onActive?.(false)
  }
}
