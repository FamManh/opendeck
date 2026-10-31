import type { FxLevel } from './prefs'

export interface GovernorOptions {
  raf: (cb: FrameRequestCallback) => number
  now: () => number
  isVisible: () => boolean
  onCap: (cap: FxLevel) => void
  /** Frame time of an unloaded display, ms. Defaults to 60Hz. */
  baseFrameMs?: number
}

export const WINDOW_MS = 3000
export const MIN_SAMPLES = 30
const MEDIUM_RATIO = 1.4 // avg frame > 1.4x base (~43fps @60Hz) => medium
const MINIMAL_RATIO = 2.4 // avg frame > 2.4x base (~25fps @60Hz) => minimal

export class FpsGovernor {
  private samples: { t: number; dt: number }[] = []
  private last: number | null = null
  private handle: number | null = null
  private sampling = false
  private cap: FxLevel | null = null
  private readonly base: number

  constructor(private o: GovernorOptions) { this.base = o.baseFrameMs ?? 1000 / 60 }

  startSampling() {
    if (this.sampling) return
    this.sampling = true
    this.samples = []
    this.last = null
    this.handle = this.o.raf(this.frame)
  }

  stopSampling() {
    this.sampling = false
    this.handle = null
    this.samples = []
    this.last = null
  }

  private frame = (_: number) => {
    this.handle = null
    if (!this.sampling) return
    const t = this.o.now()
    if (!this.o.isVisible()) {
      // Background tabs throttle rAF; discard the window rather than blame the machine.
      this.samples = []
      this.last = null
    } else {
      if (this.last !== null) this.samples.push({ t, dt: t - this.last })
      this.last = t
      while (this.samples.length && t - this.samples[0]!.t > WINDOW_MS) this.samples.shift()
      this.evaluate(t)
    }
    if (this.sampling) this.handle = this.o.raf(this.frame)
  }

  private evaluate(t: number) {
    if (this.samples.length < MIN_SAMPLES) return
    if (t - this.samples[0]!.t < WINDOW_MS * 0.9) return
    const avg = this.samples.reduce((s, x) => s + x.dt, 0) / this.samples.length
    const ratio = avg / this.base
    if (this.cap !== 'minimal' && ratio > MINIMAL_RATIO && this.cap === 'medium') this.lower('minimal')
    else if (this.cap === null && ratio > MEDIUM_RATIO) this.lower('medium')
  }

  private lower(cap: FxLevel) {
    this.cap = cap
    this.samples = []
    this.o.onCap(cap)
  }
}
