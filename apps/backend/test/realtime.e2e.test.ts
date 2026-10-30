import { createTestApp, type TestApp } from './helpers/test-app'
import { listenWorld, type Peer, type World } from './support/world'

let t: TestApp, w: World
const peers: Peer[] = []
beforeAll(async () => { t = await createTestApp(); w = await listenWorld(t.app) })
afterEach(() => { peers.splice(0).forEach(p => p.close()) })
afterAll(() => t.close())

const open = async (slug: string, cookie: string) => { const p = await w.connect(slug, cookie); peers.push(p); return p }
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
// Bỏ scale/enabledSpecials: id lá bài (vd "13") luôn nằm trong state công khai, không phải phiếu.
const wire = (p: Peer) => JSON.stringify(p.frames, (k, v) => (k === 'scale' || k === 'enabledSpecials' ? undefined : v))

/** Host đã kết nối + 1 item ("i1") + vòng đang bỏ phiếu. */
async function votingRoom(roomBody: Record<string, unknown> = {}) {
  const host = await w.user('Host')
  const slug = await w.room(host, roomBody)
  const h = await open(slug, host.cookie)
  expect((await h.cmd({ type: 'addItems', items: [{ title: 'Story' }] })).ok).toBe(true)
  expect((await h.cmd({ type: 'startRound', itemId: 'i1' })).ok).toBe(true)
  const joinGuest = async (name: string) => {
    const g = await w.guest(name)
    const cookie = await w.ticket(slug, g)
    return { ...g, cookie, peer: await open(slug, cookie) }
  }
  return { host, slug, h, joinGuest }
}

describe('authentication', () => {
  test('no cookie, or gid without room ticket → disconnected, never receives state', async () => {
    const host = await w.user()
    const slug = await w.room(host)
    const anon = await open(slug, '')
    expect(anon.frames.some(f => f.event === 'state')).toBe(false)
    expect(anon.socket.connected).toBe(false)
    const g = await w.guest()
    const noTicket = await open(slug, g.cookie)
    await noTicket.waitFor('conn:error', e => e.code === 'NO_TICKET')
    expect(noTicket.frames.some(f => f.event === 'state')).toBe(false)
    await sleep(100)
    expect(noTicket.socket.connected).toBe(false)
  })

  test('ticket for another identity or another room is useless', async () => {
    const host = await w.user()
    const slug = await w.room(host), other = await w.room(host)
    const a = await w.guest(), b = await w.guest()
    const aTicket = await w.ticket(slug, a)
    const stolen = aTicket.replace(a.cookie, b.cookie)
    const p = await open(slug, stolen)
    await p.waitFor('conn:error', e => e.code === 'NO_TICKET')
    const wrongRoom = await open(other, aTicket)
    await wrongRoom.waitFor('conn:error', e => e.code === 'NO_TICKET')
  })

  test('password room: ticket only after the right password', async () => {
    const host = await w.user()
    const slug = await w.room(host, { password: 'hunter22' })
    const g = await w.guest()
    await w.http().post(`/api/rooms/${slug}/join`).set('Cookie', g.cookie).send({ password: 'x' }).expect(403)
    const p = await open(slug, g.cookie)
    await p.waitFor('conn:error')
    const ok = await open(slug, await w.ticket(slug, g, 'hunter22'))
    await ok.waitFor('state')
  })
})

describe('commands', () => {
  test('client-sent pid is ignored; tick/join/disconnect are forbidden', async () => {
    const { joinGuest } = await votingRoom()
    const a = await joinGuest('A')
    expect(await a.peer.cmd({ type: 'vote', pid: 'u:OTHER', cardId: '5' })).toEqual({ ok: true })
    const s = await a.peer.waitFor('state', st => st.current?.myVote === '5')
    expect(s.current.voted).toEqual([a.pid])
    for (const type of ['tick', 'join', 'disconnect'])
      expect(await a.peer.cmd({ type, pid: a.pid })).toEqual({ ok: false, code: 'FORBIDDEN_CMD' })
    expect(await a.peer.cmd({ type: 'nope' })).toEqual({ ok: false, code: 'UNKNOWN_CMD' })
    expect(await a.peer.cmd('x')).toEqual({ ok: false, code: 'BAD_COMMAND' })
    expect(await a.peer.cmd({ type: 'rename', name: 42 })).toEqual({ ok: false, code: 'BAD_COMMAND' })
    expect(await a.peer.cmd({ type: 'reveal' })).toEqual({ ok: false, code: 'NOT_HOST' })
  })

  test('30 cmds in one second: at most 10 processed, the rest RATE_LIMITED', async () => {
    const { joinGuest } = await votingRoom()
    const a = await joinGuest('A')
    const acks = await Promise.all(Array.from({ length: 30 }, () => a.peer.cmd({ type: 'vote', cardId: '5' })))
    expect(acks.filter(r => r.code !== 'RATE_LIMITED')).toHaveLength(10)
    expect(acks.filter(r => r.code === 'RATE_LIMITED')).toHaveLength(20)
  })
})

describe('secret votes', () => {
  test('others see only who voted, and no frame carries the card until reveal', async () => {
    const { joinGuest, h } = await votingRoom()
    const a = await joinGuest('A'), b = await joinGuest('B')
    await a.peer.cmd({ type: 'vote', cardId: '13' })
    const ev = await b.peer.waitFor('events', e => e.some((x: any) => x.type === 'voted'))
    expect(ev).toEqual([{ type: 'voted', pid: a.pid }])
    const st = await b.peer.waitFor('state', s => s.current?.voted.includes(a.pid))
    expect(st.current).toMatchObject({ votes: null, myVote: null })
    expect(wire(b.peer)).not.toContain('"13"')
    expect(wire(h)).not.toContain('"13"')
    expect(wire(a.peer)).toContain('"13"')
    await h.cmd({ type: 'reveal' })
    const revealed = await b.peer.waitFor('state', s => s.current?.status === 'revealed')
    expect(revealed.current.votes[a.pid]).toBe('13')
  })

  test('late joiner snapshot has no one else\'s vote', async () => {
    const { joinGuest } = await votingRoom()
    const a = await joinGuest('A')
    await a.peer.cmd({ type: 'vote', cardId: '13' })
    const late = await joinGuest('Late')
    const snap = late.peer.state()
    expect(snap.current.voted).toEqual([a.pid])
    expect(wire(late.peer)).not.toContain('"13"')
  })
})

describe('presence', () => {
  test('two tabs = one participant; votes overwrite; closing one tab keeps online', async () => {
    const { joinGuest, h, slug } = await votingRoom()
    const a = await joinGuest('A')
    const tab2 = await open(slug, a.cookie)
    const state = await tab2.waitFor('state')
    expect(Object.keys(state.participants).filter(p => p === a.pid)).toHaveLength(1)
    await a.peer.cmd({ type: 'vote', cardId: '5' })
    await tab2.cmd({ type: 'vote', cardId: '8' })
    await a.peer.waitFor('state', s => s.current.myVote === '8')
    tab2.close()
    await sleep(150)
    await h.cmd({ type: 'rename', name: 'Host2' })
    const after = await h.waitFor('state', s => s.participants[h.state().hostId].name === 'Host2')
    expect(after.participants[a.pid].online).toBe(true)
    expect(Object.keys(after.participants)).toHaveLength(2)
  })

  test('closing every socket marks offline; reconnecting restores seat and own vote', async () => {
    const { joinGuest, h, slug } = await votingRoom()
    const a = await joinGuest('A')
    await a.peer.cmd({ type: 'vote', cardId: '13' })
    a.peer.close()
    await h.waitFor('state', s => s.participants[a.pid]?.online === false)
    const back = await open(slug, a.cookie)
    const s = await back.waitFor('state')
    expect(s.current.myVote).toBe('13')
    expect(Object.keys(s.participants)).toHaveLength(2)
    expect(s.participants[a.pid].online).toBe(true)
  })
})

describe('approval, kick', () => {
  test('requireApproval: host is asked, guest only gets approval:pending until approved', async () => {
    const { h, slug } = await votingRoom({ requireApproval: true })
    const g = await w.guest('Wait')
    const gp = await open(slug, await w.ticket(slug, g))
    const req = await h.waitFor('approval:request')
    expect(req).toMatchObject({ pid: g.pid, name: 'Wait' })
    await gp.waitFor('approval:pending')
    expect(h.state().pending[g.pid]).toBeDefined()
    await sleep(100)
    expect(gp.frames.some(f => f.event === 'state')).toBe(false)
    expect(gp.frames.some(f => f.event === 'events')).toBe(false)
    expect(await h.cmd({ type: 'approve', target: g.pid })).toEqual({ ok: true })
    const s = await gp.waitFor('state')
    expect(s.participants[g.pid]).toBeDefined()
    expect(s.pending).toEqual({})
  })

  test('reject disconnects the guest', async () => {
    const { h, slug } = await votingRoom({ requireApproval: true })
    const g = await w.guest()
    const gp = await open(slug, await w.ticket(slug, g))
    await h.waitFor('approval:request')
    await h.cmd({ type: 'reject', target: g.pid })
    await gp.waitFor('rejected')
  })

  test('kick: all sockets of the target get `kicked` and are dropped; reconnect is banned', async () => {
    const { h, slug, joinGuest } = await votingRoom()
    const a = await joinGuest('A')
    const tab2 = await open(slug, a.cookie)
    await tab2.waitFor('state')
    expect(await h.cmd({ type: 'kick', target: a.pid })).toEqual({ ok: true })
    await a.peer.waitFor('kicked')
    await tab2.waitFor('kicked')
    await sleep(100)
    expect(a.peer.socket.connected || tab2.socket.connected).toBe(false)
    const again = await open(slug, a.cookie)
    await again.waitFor('conn:error', e => e.code === 'banned')
    expect(again.frames.some(f => f.event === 'state')).toBe(false)
  })

  test('only the host can kick', async () => {
    const { joinGuest } = await votingRoom()
    const a = await joinGuest('A'), b = await joinGuest('B')
    expect(await a.peer.cmd({ type: 'kick', target: b.pid })).toEqual({ ok: false, code: 'NOT_HOST' })
  })
})

describe('persistence', () => {
  test('restart reloads rooms from liveState; items, outcomes and votes survive', async () => {
    const { h, slug, host, joinGuest } = await votingRoom()
    const a = await joinGuest('A')
    await a.peer.cmd({ type: 'vote', cardId: '5' })
    await h.cmd({ type: 'vote', cardId: '5' })
    await h.cmd({ type: 'reveal' })
    expect(await h.cmd({ type: 'finalize', value: '5', note: 'ok' })).toEqual({ ok: true })
    await h.cmd({ type: 'addItems', items: [{ title: 'Second' }] })
    await h.cmd({ type: 'startRound', itemId: 'i2' })
    await a.peer.cmd({ type: 'vote', cardId: '8' })
    peers.splice(0).forEach(p => p.close())

    await t.close({ keepDb: true })
    t = await createTestApp({ db: t.db })
    w = await listenWorld(t.app)

    const h2 = await open(slug, host.cookie)
    const s = await h2.waitFor('state')
    expect(s.items.map((i: { title: string; status: string }) => [i.title, i.status])).toEqual([['Story', 'done'], ['Second', 'pending']])
    expect(s.outcomes).toHaveLength(1)
    expect(s.outcomes[0]).toMatchObject({ itemId: 'i1', value: '5', note: 'ok' })
    expect(s.current.voted).toEqual([a.pid])
    const a2 = await open(slug, a.cookie)
    expect((await a2.waitFor('state')).current.myVote).toBe('8')

    const q = (sql: string) => t.ds.query(sql, [slug])
    const inRoom = `from rooms r join items i on i."roomId" = r.id where r.slug = $1`
    expect((await q(`select i.title, i.status ${inRoom} order by i."order"`)).map((r: any) => [r.title, r.status])).toEqual([['Story', 'done'], ['Second', 'pending']])
    expect((await q(`select o.value, o.note ${inRoom.replace('where', 'join outcomes o on o."itemId" = i.id where')}`))).toEqual([{ value: '5', note: 'ok' }])
    expect((await q(`select v."participantKey", v."cardId", v.round ${inRoom.replace('where', 'join votes v on v."itemId" = i.id where')} order by v."participantKey"`)).map((r: any) => [r.participantKey, r.cardId, r.round]))
      .toEqual([[a.pid, '5', 1], [`u:${host.id}`, '5', 1]].sort())
  })
})

describe('latency', () => {
  test('20 voters: p95 vote → event delivery < 300 ms', async () => {
    const { h, joinGuest } = await votingRoom()
    const voters = await Promise.all(Array.from({ length: 20 }, (_, i) => joinGuest(`V${i}`)))
    await h.waitFor('state', s => Object.keys(s.participants).length === 21)
    const observer = voters[0]!.peer
    const sent = new Map<string, number>()
    const took: number[] = []
    observer.socket.on('events', (evs: Array<{ type: string; pid: string }>) => {
      for (const e of evs) if (e.type === 'voted' && sent.has(e.pid)) took.push(performance.now() - sent.get(e.pid)!)
    })
    await Promise.all(voters.map(v => { sent.set(v.pid, performance.now()); return v.peer.cmd({ type: 'vote', cardId: '5' }) }))
    await sleep(300)
    expect(took).toHaveLength(20)
    took.sort((x, y) => x - y)
    expect(took[Math.ceil(took.length * 0.95) - 1]).toBeLessThan(300)
  })
})
