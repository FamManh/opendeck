import { create } from 'zustand'
import { toast } from 'sonner'
import i18n from '@/i18n'
import type { DomainEvent, PublicRoomState } from '@/domain'
import { FxDirector } from './director'
import { FpsGovernor } from './governor'
import { type FxLevel, getFxSettings, setGovernorCap, soundEnabled } from './prefs'
import { soundBank } from './sound'
import { planFinalize, planReveal, type Step } from './timeline'

export const MAX_FLOATING_REACTIONS = 30
export const REACTION_FLOAT_MS = 1600
const AWAIT_EVENTS_MS = 400
const CONSENSUS_MS = 2000

export interface FxHold { flipped: Set<string>; all: boolean }
export interface Discussion { low: string[]; high: string[] }
export interface FloatingReaction { id: number; emoji: string; x: number }
export interface Plane { id: number; from: string; target: string; kind: 'paper' | 'plane' }
export interface Spin { chosen: 'low' | 'high'; pid: string; turns: number }

interface FxStore {
  /** Non-null while a reveal is being choreographed: unflipped cards stay face down and results stay hidden. */
  hold: FxHold | null
  countdown: 3 | 2 | 1 | null
  moment: 'consensus' | 'twist' | null
  discussion: Discussion | null
  stamp: boolean
  roundKey: string | null
  roundStartedAt: number
  floating: FloatingReaction[]
  planes: Plane[]
  spin: Spin | null
}

const initial: FxStore = {
  hold: null, countdown: null, moment: null, discussion: null, stamp: false,
  roundKey: null, roundStartedAt: Date.now(), floating: [], planes: [], spin: null,
}

export const useFxStore = create<FxStore>(() => ({ ...initial }))
const set = useFxStore.setState
const get = useFxStore.getState

const director = new FxDirector()
const finalDirector = new FxDirector()
const timers = new Set<ReturnType<typeof setTimeout>>()
let awaitTimer: ReturnType<typeof setTimeout> | null = null
let seq = 0

const governor = new FpsGovernor({
  raf: cb => requestAnimationFrame(cb),
  now: () => performance.now(),
  isVisible: () => !document.hidden,
  onCap: (cap: FxLevel) => {
    setGovernorCap(cap)
    toast(i18n.t('fx.downgraded', { level: i18n.t(`fx.level.${cap}`) }))
  },
})

function later(ms: number, fn: () => void) {
  const id = setTimeout(() => { timers.delete(id); fn() }, ms)
  timers.add(id)
}

function cancelTimeline() {
  director.cancel()
  governor.stopSampling()
  if (awaitTimer) clearTimeout(awaitTimer)
  awaitTimer = null
  timers.forEach(clearTimeout)
  timers.clear()
}

function apply(step: Step, sound: boolean) {
  switch (step.kind) {
    case 'countdown':
      set({ countdown: step.n })
      if (sound && step.n === 3) soundBank.play('drum')
      break
    case 'flip':
      set(s => ({ hold: s.hold ? { ...s.hold, flipped: new Set(s.hold.flipped).add(step.pid) } : s.hold }))
      if (sound) soundBank.play('flip')
      break
    case 'flipAll':
      set(s => ({ hold: s.hold ? { ...s.hold, all: true } : s.hold }))
      if (sound) soundBank.play('flip')
      break
    case 'results':
      governor.stopSampling()
      set({ hold: null, countdown: null })
      break
    case 'moment':
      set({ moment: step.name })
      if (step.name === 'consensus') later(CONSENSUS_MS, () => set(s => (s.moment === 'consensus' ? { moment: null } : s)))
      break
    default:
      break
  }
}

const keyOf = (s: PublicRoomState | null) => (s?.current ? `${s.current.itemId}:${s.current.number}` : null)

export const fxRuntime = {
  /** Called with every state snapshot, before it is rendered. Detects the voting → revealed transition. */
  onState(prev: PublicRoomState | null, next: PublicRoomState) {
    const key = keyOf(next)
    if (key !== get().roundKey) {
      cancelTimeline()
      set({ roundKey: key, roundStartedAt: Date.now(), hold: null, countdown: null, moment: null, discussion: null, spin: null })
    }
    if (prev?.current?.status === 'voting' && next.current?.status === 'revealed' && keyOf(prev) === key && !get().hold) {
      // Hold cards face down until the `events` frame (sent right after) starts the choreography; give up if it never comes.
      set({ hold: { flipped: new Set(), all: false } })
      awaitTimer = setTimeout(() => { awaitTimer = null; if (!director.running) set({ hold: null }) }, AWAIT_EVENTS_MS)
    }
  },

  /** Called with each `events` frame; effects run only from events, never from snapshots. */
  onEvents(events: DomainEvent[], state: PublicRoomState | null) {
    const { level, prefs } = getFxSettings()
    const sound = soundEnabled(prefs, level)
    const cur = state?.current
    if (events.some(e => e.type === 'revealed') && state && cur?.status === 'revealed' && cur.stats) {
      if (awaitTimer) clearTimeout(awaitTimer)
      awaitTimer = null
      const disc = events.find((e): e is Extract<DomainEvent, { type: 'discussionNeeded' }> => e.type === 'discussionNeeded')
      const seatOrder = Object.values(state.participants)
        .filter(p => cur.votes?.[p.id] !== undefined)
        .sort((a, b) => a.joinedAt - b.joinedAt)
        .map(p => p.id)
      set({ hold: { flipped: new Set(), all: false }, countdown: null, moment: null, discussion: disc ? { low: disc.lowPids, high: disc.highPids } : null })
      governor.startSampling()
      director.play(planReveal(level, seatOrder, cur.stats), s => apply(s, sound))
    }
    const fin = events.find((e): e is Extract<DomainEvent, { type: 'finalized' }> => e.type === 'finalized')
    if (fin) finalDirector.play(planFinalize(level, fin.itemId), s => set({ stamp: s.kind === 'stamp' }))
  },

  addReactions(items: { emoji: string; count: number }[]) {
    const room = MAX_FLOATING_REACTIONS - get().floating.length
    const add: FloatingReaction[] = []
    for (const { emoji, count } of items) {
      for (let i = 0; i < count && add.length < room; i++) add.push({ id: ++seq, emoji, x: 10 + Math.random() * 80 })
    }
    if (add.length === 0) return
    set(s => ({ floating: [...s.floating, ...add] }))
    const ids = new Set(add.map(a => a.id))
    setTimeout(() => set(s => ({ floating: s.floating.filter(f => !ids.has(f.id)) })), REACTION_FLOAT_MS)
  },

  addPlane(p: Omit<Plane, 'id'>) {
    const plane = { ...p, id: ++seq }
    set(s => ({ planes: [...s.planes, plane] }))
    setTimeout(() => set(s => ({ planes: s.planes.filter(x => x.id !== plane.id) })), 1300)
  },

  setSpin(spin: Spin) { set({ spin }) },

  /** Jump to the final state (tab became visible again). */
  flush() {
    director.flush()
    finalDirector.flush()
  },

  /** Arms the first-gesture sound unlock and the visibility flush; returns the cleanup. */
  start() {
    const unlock = () => { void soundBank.unlock() }
    const vis = () => { if (!document.hidden) fxRuntime.flush() }
    document.addEventListener('pointerdown', unlock, { once: true })
    document.addEventListener('visibilitychange', vis)
    return () => {
      document.removeEventListener('pointerdown', unlock)
      document.removeEventListener('visibilitychange', vis)
    }
  },

  reset() {
    cancelTimeline()
    finalDirector.cancel()
    set({ ...initial, roundStartedAt: Date.now() })
  },
}
