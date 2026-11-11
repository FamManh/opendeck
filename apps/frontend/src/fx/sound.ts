export type SoundName = 'drum' | 'flip' | 'tick' | 'splat' | 'bonk' | 'pop' | 'thunk' | 'boom'

type CtxLike = Pick<AudioContext, 'createBuffer' | 'createBufferSource' | 'destination' | 'resume' | 'sampleRate'>

type Synth = (t: number) => number

// Sounds are synthesized in code (no files to download): [duration seconds, sample function].
const RECIPES: Record<SoundName, [number, Synth]> = {
  drum: [0.28, t => Math.sin(2 * Math.PI * (160 - 420 * t) * t) * Math.exp(-t * 14)],
  flip: [0.09, t => (Math.sin(t * 91237) * 0.5 + Math.sin(t * 40123) * 0.5) * Math.exp(-t * 45) * 0.6],
  tick: [0.04, t => Math.sin(2 * Math.PI * 1400 * t) * Math.exp(-t * 90) * 0.5],
  // Wet thud: noise burst over a low body.
  splat: [0.22, t => ((Math.random() * 2 - 1) * 0.6 + Math.sin(2 * Math.PI * 90 * t)) * Math.exp(-t * 22) * 0.55],
  // Cartoon bonk: falling pitch.
  bonk: [0.2, t => Math.sin(2 * Math.PI * (620 - 900 * t) * t) * Math.exp(-t * 16) * 0.5],
  // Bubbly pop: rising pitch.
  // Arrow hitting wood: a click on top of a short low knock.
  thunk: [0.16, t => ((t < 0.004 ? Math.random() * 2 - 1 : 0) + Math.sin(2 * Math.PI * 140 * t)) * Math.exp(-t * 30) * 0.6],
  // Explosion: long rumbling noise with a falling low tone.
  boom: [0.7, t => ((Math.random() * 2 - 1) * 0.7 + Math.sin(2 * Math.PI * (70 - 40 * t) * t)) * Math.exp(-t * 6) * 0.6],
  pop: [0.12, t => Math.sin(2 * Math.PI * (600 + 1600 * t) * t) * Math.exp(-t * 28) * 0.45],
}

export class SoundBank {
  private ctx: CtxLike | null = null
  private buffers = new Map<SoundName, AudioBuffer>()
  private unlocked = false

  constructor(private ctxFactory: () => CtxLike = () => new AudioContext()) {}

  /** Must be called from a user gesture (iOS); the audio context is only created here. */
  async unlock() {
    if (this.unlocked) return
    this.unlocked = true
    try {
      const ctx = this.ctxFactory()
      await ctx.resume()
      for (const [name, [seconds, synth]] of Object.entries(RECIPES) as [SoundName, [number, Synth]][]) {
        const rate = ctx.sampleRate
        const buf = ctx.createBuffer(1, Math.max(1, Math.floor(seconds * rate)), rate)
        const data = buf.getChannelData(0)
        for (let i = 0; i < data.length; i++) data[i] = synth(i / rate)
        this.buffers.set(name, buf)
      }
      this.ctx = ctx
    } catch {
      /* audio is optional */
    }
  }

  play(name: SoundName) {
    const buf = this.buffers.get(name)
    if (!this.ctx || !buf) return
    try {
      const src = this.ctx.createBufferSource()
      src.buffer = buf
      src.connect(this.ctx.destination)
      src.start()
    } catch {
      /* ignore */
    }
  }
}

export const soundBank = new SoundBank()
