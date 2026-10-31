import { createTestApp, type TestApp } from './helpers/test-app'
import { listenWorld, type Peer, type World } from './support/world'

let t: TestApp, w: World
const peers: Peer[] = []
beforeAll(async () => { t = await createTestApp(); w = await listenWorld(t.app) })
afterEach(() => { peers.splice(0).forEach(p => p.close()) })
afterAll(() => t.close())

const open = async (slug: string, cookie: string) => { const p = await w.connect(slug, cookie); peers.push(p); return p }
const ack = (p: Peer, event: string, body: unknown) =>
  new Promise<{ ok: boolean; code?: string }>(r => p.socket.emit(event, body, r))

async function room(n: number) {
  const host = await w.user('Host')
  const slug = await w.room(host)
  const h = await open(slug, host.cookie)
  const guests: Array<{ pid: string; peer: Peer }> = []
  for (let i = 0; i < n; i++) {
    const g = await w.guest(`G${i}`)
    guests.push({ pid: g.pid, peer: await open(slug, await w.ticket(slug, g)) })
  }
  return { host, slug, h, guests }
}

describe('fx channel', () => {
  test('reactions are rate limited per participant and batched anonymously', async () => {
    const { h, guests } = await room(1)
    const acks = await Promise.all(Array.from({ length: 7 }, () => ack(guests[0]!.peer, 'fx:react', { emoji: '👏' })))
    expect(acks.filter(a => a.ok)).toHaveLength(5)
    expect(acks.filter(a => a.code === 'RATE_LIMITED')).toHaveLength(2)
    const batch = await h.waitFor('fx:reactions')
    expect(batch.items.reduce((n: number, i: { count: number }) => n + i.count, 0)).toBe(5)
    expect(JSON.stringify(batch)).not.toContain(guests[0]!.pid)
    expect((await ack(h, 'fx:react', { emoji: '💩' })).code).toBe('BAD_EMOJI')
  })

  test('spin: host only; everyone sees the same result', async () => {
    const { h, guests } = await room(3)
    expect((await h.cmd({ type: 'addItems', items: [{ title: 'S' }] })).ok).toBe(true)
    expect((await h.cmd({ type: 'startRound', itemId: 'i1' })).ok).toBe(true)
    await h.cmd({ type: 'vote', cardId: '1' })
    await guests[0]!.peer.cmd({ type: 'vote', cardId: '13' })
    await guests[1]!.peer.cmd({ type: 'vote', cardId: '13' })
    await guests[2]!.peer.cmd({ type: 'vote', cardId: '2' })
    expect((await h.cmd({ type: 'reveal' })).ok).toBe(true)
    expect((await ack(guests[0]!.peer, 'fx:spin', {})).code).toBe('NOT_HOST')
    expect((await ack(h, 'fx:spin', {})).ok).toBe(true)
    const a = await h.waitFor('fx:spun')
    const b = await guests[2]!.peer.waitFor('fx:spun')
    expect(b).toEqual(a)
    expect(['low', 'high']).toContain(a.chosen)
    expect((await ack(h, 'fx:spin', {})).code).toBe('ALREADY_SPUN')
  })

  test('throw only at someone who has not voted; nothing from fx changes room state', async () => {
    const { h, guests } = await room(2)
    await h.cmd({ type: 'addItems', items: [{ title: 'S' }] })
    await h.cmd({ type: 'startRound', itemId: 'i1' })
    await guests[0]!.peer.cmd({ type: 'vote', cardId: '5' })
    const before = JSON.stringify(h.state())
    expect((await ack(h, 'fx:throw', { target: guests[0]!.pid, kind: 'plane' })).code).toBe('TARGET_NOT_IDLE')
    expect((await ack(h, 'fx:throw', { target: guests[1]!.pid, kind: 'plane' })).ok).toBe(true)
    const thrown = await guests[1]!.peer.waitFor('fx:thrown')
    expect(thrown).toMatchObject({ target: guests[1]!.pid, kind: 'plane' })
    expect(JSON.stringify(h.state())).toBe(before)
  })
})
