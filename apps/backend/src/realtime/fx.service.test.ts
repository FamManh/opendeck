import { describe, expect, test } from 'vitest'
import { guest, room, run, T0 } from '../domain/room/testing'
import type { Command, RoomState } from '../domain'
import { FxService, REACTION_MAX, THROW_COOLDOWN_MS } from './fx.service'

function make(rand: () => number = () => 0) {
  let now = T0
  const fx = new FxService(() => now, rand)
  return { fx, advance: (ms: number) => { now += ms } }
}

function voting(votes: Record<string, string> = {}): RoomState {
  const cmds: Command[] = [
    { type: 'join', participant: guest('a') },
    { type: 'join', participant: guest('b') },
    { type: 'join', participant: guest('c') },
    { type: 'addItems', pid: 'H', items: [{ title: 'S' }] },
    { type: 'startRound', pid: 'H', itemId: 'i1' },
    ...Object.entries(votes).map(([pid, cardId]): Command => ({ type: 'vote', pid, cardId })),
  ]
  return run(room(), cmds).state
}

describe('react', () => {
  test('5 per 2s per participant, the rest are RATE_LIMITED', () => {
    const { fx } = make()
    const results = Array.from({ length: 7 }, () => fx.react('s', 'a', '👏'))
    expect(results.filter(r => r.ok)).toHaveLength(REACTION_MAX)
    expect(results.at(-1)).toEqual({ ok: false, code: 'RATE_LIMITED' })
  })

  test('window slides: allowed again after 2s', () => {
    const { fx, advance } = make()
    for (let i = 0; i < 5; i++) fx.react('s', 'a', '👏')
    advance(2001)
    expect(fx.react('s', 'a', '👏').ok).toBe(true)
  })

  test('rejects emoji outside the list', () => {
    expect(make().fx.react('s', 'a', '💩')).toEqual({ ok: false, code: 'BAD_EMOJI' })
  })

  test('drain merges counts per emoji without pids, then empties', () => {
    const { fx } = make()
    for (const pid of ['a', 'b', 'c', 'd']) for (let i = 0; i < 5; i++) fx.react('s', pid, '👏')
    fx.react('s', 'e', '😮')
    expect(fx.drain('s')).toEqual([{ emoji: '👏', count: 20 }, { emoji: '😮', count: 1 }])
    expect(fx.drain('s')).toEqual([])
  })
})

describe('throwAt', () => {
  test('only at an online voter who has not voted, with a per-pair cooldown', () => {
    const { fx, advance } = make()
    const s = voting({ b: '5' })
    expect(fx.throwAt('s', s, 'a', 'b', 'plane')).toEqual({ ok: false, code: 'TARGET_NOT_IDLE' })
    expect(fx.throwAt('s', s, 'a', 'c', 'plane').ok).toBe(true)
    expect(fx.throwAt('s', s, 'a', 'c', 'plane')).toEqual({ ok: false, code: 'RATE_LIMITED' })
    advance(THROW_COOLDOWN_MS)
    expect(fx.throwAt('s', s, 'a', 'c', 'paper').ok).toBe(true)
  })

  test('not at yourself, strangers or with a bad kind', () => {
    const { fx } = make()
    const s = voting()
    expect(fx.throwAt('s', s, 'a', 'a', 'plane')).toEqual({ ok: false, code: 'BAD_TARGET' })
    expect(fx.throwAt('s', s, 'a', 'zz', 'plane')).toEqual({ ok: false, code: 'BAD_TARGET' })
    expect(fx.throwAt('s', s, 'a', 'c', 'rock')).toEqual({ ok: false, code: 'BAD_KIND' })
  })
})

describe('spin', () => {
  const revealed = () => run(voting({ H: '1', a: '13', b: '13', c: '2' }), [{ type: 'reveal', pid: 'H' }]).state
  const seq = (...v: number[]) => { let i = 0; return () => v[i++ % v.length]! }

  test('host only, once per reveal, only when discussion is needed', () => {
    const { fx } = make(seq(0.9, 0.0, 0.0))
    const s = revealed()
    expect(fx.spin('s', s, 'a')).toEqual({ ok: false, code: 'NOT_HOST' })
    const r = fx.spin('s', s, 'H')
    expect(r).toEqual({ ok: true, value: { chosen: 'high', pid: 'a', turns: 3 } })
    expect(fx.spin('s', s, 'H')).toEqual({ ok: false, code: 'ALREADY_SPUN' })
    expect(make().fx.spin('s', voting(), 'H')).toEqual({ ok: false, code: 'NOT_DISCUSSION' })
  })

  test('picks a pid from the chosen side', () => {
    const { fx } = make(seq(0.1, 0.0, 0.99))
    const r = fx.spin('s', revealed(), 'H')
    expect(r).toEqual({ ok: true, value: { chosen: 'low', pid: 'H', turns: 4 } })
  })
})
