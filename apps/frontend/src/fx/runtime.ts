import { create } from 'zustand'
import { toast } from 'sonner'
import i18n from '@/i18n'
import type { DomainEvent, PublicRoomState } from '@/domain'
import { FxDirector } from './director'
import { FpsGovernor } from './governor'
import { type FxLevel, getFxSettings, setGovernorCap, soundEnabled } from './prefs'
import { soundBank } from './sound'
import { planFinalize, planReveal, type Step } from './timeline'
import { FLIGHT_MS, HIT_MS, isItemKind, MAX_HITS_PER_SEAT, type ItemKind, type NudgeKind, type ThrowKind } from './throws'

export const MAX_FLOATING_REACTIONS = 30
/** Longest a floating reaction lives: max rise time plus max start stagger. */
export const REACTION_FLOAT_MS = 4200
const RISE_MIN_MS = 2600
const RISE_SPREAD_MS = 1000
const STAGGER_MS = 120
const AWAIT_EVENTS_MS = 400
const CONSENSUS_MS = 3000
/** How long the explosion plays over the table; the smoke that follows comes from room state. */
export const BOMB_MS = 1800
export const YAWN_MS = 3200

export interface FxHold { flipped: Set<string>; all: boolean }
export interface Discussion { low: string[]; high: string[] }
/** `x` in % of the layer width; `dur`/`delay` in ms. */
export interface FloatingReaction { id: number; emoji: string; x: number; dur: number; delay: number }
export interface Plane { id: number; from: string; target: string; kind: NudgeKind }
/** A fun item in the air; `level` is frozen at throw time so a mid-flight downgrade can't half-play it. */
export interface Flight { id: number; from: string; target: string; kind: ItemKind; level: FxLevel }
/** One thing that landed on a seat; hits on the same seat stack, the newest restarts the squash. */
export interface Hit { id: number; kind: ItemKind; level: FxLevel }
export interface Spin { chosen: 'low' | 'high'; pid: string; turns: number }

interface FxStore {
  /** Non-null while a reveal is being choreographed: unflipped cards stay face down and results stay hidden. */
  hold: FxHold | null
  countdown: 3 | 2 | 1 | null
  moment: 'consensus' | 'twist' | 'bomb' | null
  /** Someone played ☕: every mascot yawns for a moment. */
  yawn: boolean
  discussion: Discussion | null
  stamp: boolean
  roundKey: string | null
  roundStartedAt: number
  floating: FloatingReaction[]
  planes: Plane[]
  flights: Flight[]
  /** Active hits per target pid, oldest first. */
  hits: Record<string, Hit[]>
  spin: Spin | null
}

const initial: FxStore = {
  hold: null, countdown: null, moment: null, yawn: false, discussion: null, stamp: false,
  roundKey: null, roundStartedAt: Date.now(), floating: [], planes: [], flights: [], hits: {}, spin: null,
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

// The governor samples while any heavy effect runs: the reveal timeline or the throw physics.
const sampling = new Set<'reveal' | 'physics'>()
function sample(reason: 'reveal' | 'physics', on: boolean) {
  if (on) sampling.add(reason)
  else sampling.delete(reason)
  if (sampling.size) governor.startSampling()
  else governor.stopSampling()
}

function later(ms: number, fn: () => void) {
  const id = setTimeout(() => { timers.delete(id); fn() }, ms)
  timers.add(id)
}

function cancelTimeline() {
  director.cancel()
  sample('reveal', false)
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
      sample('reveal', false)
      set({ hold: null, countdown: null })
      break
    case 'moment':
      set({ moment: step.name })
      if (step.name === 'consensus') later(CONSENSUS_MS, () => set(s => (s.moment === 'consensus' ? { moment: null } : s)))
      if (step.name === 'bomb') {
        if (sound) soundBank.play('boom')
        later(BOMB_MS, () => set(s => (s.moment === 'bomb' ? { moment: null } : s)))
      }
      break
    case 'yawn':
      set({ yawn: true })
      later(YAWN_MS, () => set({ yawn: false }))
      break
    default:
      break
  }
}

const HIT_SOUND = { tomato: 'splat', poop: 'splat', roll: 'bonk', arrow: 'thunk', bomb: 'boom', heart: 'pop' } as const

const keyOf = (s: PublicRoomState | null) => (s?.current ? `${s.current.itemId}:${s.current.number}` : null)

export const fxRuntime = {
  /** Called with every state snapshot, before it is rendered. Detects the voting → revealed transition. */
  onState(prev: PublicRoomState | null, next: PublicRoomState) {
    const key = keyOf(next)
    // A round nobody voted in keeps its number, so a revote can share the key with the round it replaces.
    if (key !== get().roundKey || (prev?.current?.status === 'revealed' && next.current?.status === 'voting')) {
      cancelTimeline()
      set({ roundKey: key, roundStartedAt: Date.now(), hold: null, countdown: null, moment: null, yawn: false, discussion: null, spin: null })
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
      set({ hold: { flipped: new Set(), all: false }, countdown: null, moment: null, yawn: false, discussion: disc ? { low: disc.lowPids, high: disc.highPids } : null })
      sample('reveal', true)
      director.play(planReveal(level, seatOrder, cur.stats), s => apply(s, sound))
    }
    const fin = events.find((e): e is Extract<DomainEvent, { type: 'finalized' }> => e.type === 'finalized')
    if (fin) finalDirector.play(planFinalize(level, fin.itemId), s => set({ stamp: s.kind === 'stamp' }))
  },

  addReactions(items: { emoji: string; count: number }[]) {
    const room = MAX_FLOATING_REACTIONS - get().floating.length
    const add: FloatingReaction[] = []
    for (const { emoji, count } of items) {
      for (let i = 0; i < count && add.length < room; i++) {
        add.push({
          id: ++seq,
          emoji,
          x: 6 + Math.random() * 88,
          dur: RISE_MIN_MS + Math.random() * RISE_SPREAD_MS,
          delay: Math.min(add.length * STAGGER_MS, REACTION_FLOAT_MS - RISE_MIN_MS - RISE_SPREAD_MS),
        })
      }
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

  /** `fx:thrown`: nudges keep the paper-plane path; items fly, then land as a hit on the target. */
  addThrow(p: { from: string; target: string; kind: ThrowKind }) {
    if (!isItemKind(p.kind)) { fxRuntime.addPlane({ from: p.from, target: p.target, kind: p.kind }); return }
    const { level, prefs } = getFxSettings()
    const id = ++seq
    const flight: Flight = { id, from: p.from, target: p.target, kind: p.kind, level }
    const land = () => {
      set(s => ({
        flights: s.flights.filter(f => f.id !== id),
        hits: { ...s.hits, [p.target]: [...(s.hits[p.target] ?? []), { id, kind: flight.kind, level }].slice(-MAX_HITS_PER_SEAT) },
      }))
      if (soundEnabled(prefs, level)) soundBank.play(HIT_SOUND[flight.kind])
      setTimeout(() => set(s => {
        const list = s.hits[p.target]
        if (!list?.some(h => h.id === id)) return s
        const left = list.filter(h => h.id !== id)
        const { [p.target]: _, ...rest } = s.hits
        return { hits: left.length ? { ...rest, [p.target]: left } : rest }
      }), HIT_MS)
    }
    if (level === 'minimal') { land(); return }
    set(s => ({ flights: [...s.flights, flight] }))
    setTimeout(land, FLIGHT_MS)
  },

  /** The throw layer reports when debris is moving so slow machines get downgraded like during a reveal. */
  physicsActive(on: boolean) { sample('physics', on) },

  setSpin(spin: Spin) { set({ spin }) },

  dismissTwist() { set(s => (s.moment === 'twist' ? { moment: null } : s)) },

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
    sample('physics', false)
    finalDirector.cancel()
    set({ ...initial, roundStartedAt: Date.now() })
  },
}
