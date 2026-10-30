import { PRESET_SCALES, createRoom } from '../domain'
import { DomainError } from '../domain'
import { RoomStoreService } from './room-store.service'

const owner = { id: 'u:O', userId: 'O', name: 'O', avatar: 'cat', role: 'voter' as const }

function setup() {
  let t = 1000
  const live = createRoom({ id: 'r', owner, scale: PRESET_SCALES.fibonacci, now: t })
  const repo = { findOneBy: vi.fn(async ({ slug }: { slug: string }) => (slug === 'abc' ? { slug, liveState: structuredClone(live) } : null)) }
  const store = new RoomStoreService(repo as never, () => t)
  return { store, repo, advance: (ms: number) => { t += ms } }
}

test('loads from liveState once and marks everyone offline', async () => {
  const { store, repo } = setup()
  const s = await store.load('abc')
  expect(s.participants['u:O']?.online).toBe(false)
  await store.load('abc')
  expect(repo.findOneBy).toHaveBeenCalledTimes(1)
})

test('unknown room rejects with ROOM_NOT_FOUND', async () => {
  const { store } = setup()
  await expect(store.load('nope')).rejects.toMatchObject({ code: 'ROOM_NOT_FOUND' })
})

test('commands on one room run in order and emit on events$', async () => {
  const { store } = setup()
  const seen: string[] = []
  store.events$.subscribe(u => seen.push(...u.events.map(e => e.type)))
  const guest = { id: 'g:1', userId: null, name: 'G', avatar: 'dog', role: 'voter' as const }
  await Promise.all([
    store.dispatch('abc', { type: 'join', participant: guest }),
    store.dispatch('abc', { type: 'addItems', pid: 'u:O', items: [{ title: 'A' }] }),
  ])
  expect(seen).toEqual(['joined', 'itemsAdded'])
})

test('a failing command leaves state intact and does not block the queue', async () => {
  const { store } = setup()
  const bad = store.dispatch('abc', { type: 'reveal', pid: 'u:O' })
  const good = store.dispatch('abc', { type: 'addItems', pid: 'u:O', items: [{ title: 'A' }] })
  await expect(bad).rejects.toBeInstanceOf(DomainError)
  await good
  expect((await store.load('abc')).items).toHaveLength(1)
})

test('tick uses the injected clock for auto reveal timers', async () => {
  const { store, advance } = setup()
  await store.dispatch('abc', { type: 'join', participant: { id: 'u:O', userId: 'O', name: 'O', avatar: 'cat', role: 'voter' } })
  await store.dispatch('abc', { type: 'addItems', pid: 'u:O', items: [{ title: 'A' }] })
  await store.dispatch('abc', { type: 'startRound', pid: 'u:O', itemId: 'i1', timerSec: 5 })
  advance(5000)
  const { events } = await store.dispatch('abc', { type: 'tick' })
  expect(events.map(e => e.type)).toContain('revealed')
})
