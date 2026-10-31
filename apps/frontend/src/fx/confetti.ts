export const CONFETTI_COLORS = ['#FFB627', '#F26A2E', '#5CC8C2', '#A68BFF', '#7BC86C', '#FF9DBB']
export const CONFETTI_DURATION_MS = 2000

interface Particle { x: number; y: number; vx: number; vy: number; rot: number; vr: number; size: number; color: string }

export interface ConfettiOptions {
  count: number
  durationMs?: number
  colors?: string[]
  random?: () => number
}

export class ConfettiCanvas {
  private particles: Particle[] = []
  private raf: number | null = null
  private start = 0
  private readonly duration: number
  private readonly colors: string[]
  private readonly rand: () => number

  constructor(private canvas: HTMLCanvasElement, private opts: ConfettiOptions) {
    this.duration = opts.durationMs ?? CONFETTI_DURATION_MS
    this.colors = opts.colors ?? CONFETTI_COLORS
    this.rand = opts.random ?? Math.random
  }

  get active() { return this.particles.length }

  /** Spawns up to `count` particles in total; calling it again never exceeds the cap. */
  burst() {
    const w = this.canvas.width
    const missing = this.opts.count - this.particles.length
    for (let i = 0; i < missing; i++) {
      this.particles.push({
        x: w / 2 + (this.rand() - 0.5) * w * 0.4,
        y: this.canvas.height * 0.4,
        vx: (this.rand() - 0.5) * 9,
        vy: -4 - this.rand() * 7,
        rot: this.rand() * Math.PI * 2,
        vr: (this.rand() - 0.5) * 0.3,
        size: 6 + this.rand() * 6,
        color: this.colors[Math.floor(this.rand() * this.colors.length)] ?? '#FFB627',
      })
    }
    if (this.raf === null) {
      this.start = performance.now()
      this.raf = requestAnimationFrame(this.tick)
    }
  }

  destroy() {
    if (this.raf !== null) cancelAnimationFrame(this.raf)
    this.raf = null
    this.particles = []
  }

  private tick = (now: number) => {
    this.raf = null
    if (now - this.start >= this.duration) {
      this.particles = []
      this.canvas.getContext('2d')?.clearRect(0, 0, this.canvas.width, this.canvas.height)
      return
    }
    const ctx = this.canvas.getContext('2d')
    ctx?.clearRect(0, 0, this.canvas.width, this.canvas.height)
    const fade = Math.max(0, Math.min(1, (this.duration - (now - this.start)) / 400))
    for (const p of this.particles) {
      p.vy += 0.25
      p.x += p.vx
      p.y += p.vy
      p.rot += p.vr
      if (!ctx) continue
      ctx.save()
      ctx.globalAlpha = fade
      ctx.translate(p.x, p.y)
      ctx.rotate(p.rot)
      ctx.fillStyle = p.color
      ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2)
      ctx.restore()
    }
    this.raf = requestAnimationFrame(this.tick)
  }
}
