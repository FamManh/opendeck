import { expect, test } from 'vitest'
import type { Participant, RoundStats } from '@/domain'
import { deriveMascotState, type MascotContext, SLEEP_AFTER_MS } from './mascotState'

const p = (o: Partial<Participant> = {}): Participant => ({
  id: 'a', userId: null, name: 'A', avatar: 'x', role: 'voter', joinedAt: 0, online: true, offlineSince: null, ...o,
})
const ctx = (o: Partial<MascotContext> = {}): MascotContext => ({
  status: 'voting', voted: false, cardId: null, stats: null, now: 1000, roundStartedAt: 0, moment: null, ...o,
})
const stats = { modes: [{ id: '5', label: '5', numeric: 5, special: false }] } as unknown as RoundStats

test('offline is away', () => expect(deriveMascotState(p({ online: false }), ctx())).toBe('away'))
test('voted while voting', () => expect(deriveMascotState(p(), ctx({ voted: true }))).toBe('voted'))
test('not voted after 45s sleeps', () => {
  expect(deriveMascotState(p(), ctx({ now: SLEEP_AFTER_MS + 1 }))).toBe('sleeping')
})
test('not voted before 45s thinks', () => {
  expect(deriveMascotState(p(), ctx({ now: SLEEP_AFTER_MS }))).toBe('thinking')
})
test('observer never sleeps', () => {
  expect(deriveMascotState(p({ role: 'observer' }), ctx({ now: SLEEP_AFTER_MS * 5 }))).toBe('thinking')
})
test('celebrates when card is a mode during consensus moment', () => {
  const c = ctx({ status: 'revealed', voted: true, cardId: '5', stats, moment: 'consensus' })
  expect(deriveMascotState(p(), c)).toBe('dancing')
  expect(deriveMascotState(p(), { ...c, cardId: '8' })).toBe('voted')
})

test('consensus: the mode voters dance', () => {
  expect(deriveMascotState(p(), ctx({ status: 'revealed', voted: true, cardId: '5', stats, moment: 'consensus' }))).toBe('dancing')
})
test('☕ on the table: everyone yawns after the reveal, but dancing wins', () => {
  expect(deriveMascotState(p(), ctx({ status: 'revealed', voted: true, cardId: '8', stats, yawn: true }))).toBe('yawning')
  expect(deriveMascotState(p(), ctx({ status: 'revealed', voted: true, cardId: '5', stats, yawn: true, moment: 'consensus' }))).toBe('dancing')
  expect(deriveMascotState(p({ online: false }), ctx({ status: 'revealed', yawn: true }))).toBe('away')
})
