import type { Step } from './timeline'

export class FxDirector {
  private timers: ReturnType<typeof setTimeout>[] = []
  private pending: { steps: Step[]; onStep: (s: Step) => void; fired: number } | null = null

  /** Starts a timeline; any timeline still running is cancelled first. */
  play(steps: Step[], onStep: (s: Step) => void) {
    this.cancel()
    const ordered = [...steps].sort((a, b) => a.at - b.at)
    const run = { steps: ordered, onStep, fired: 0 }
    this.pending = run
    for (const step of ordered) {
      this.timers.push(
        setTimeout(() => {
          if (this.pending !== run) return
          run.fired++
          if (run.fired === ordered.length) this.pending = null
          onStep(step)
        }, step.at),
      )
    }
  }

  /** Drops all timers; steps not yet fired are not delivered. */
  cancel() {
    this.timers.forEach(clearTimeout)
    this.timers = []
    this.pending = null
  }

  /** Cancels and delivers the remaining steps immediately (tab became visible, etc.). */
  flush() {
    const run = this.pending
    if (!run) return
    const rest = run.steps.slice(run.fired)
    this.cancel()
    rest.forEach(run.onStep)
  }

  get running() { return this.pending !== null }
}
