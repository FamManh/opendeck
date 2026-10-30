import { createTestApp, type TestApp } from './helpers/test-app'
import { listenWorld, type World } from './support/world'

let t: TestApp, w: World
beforeAll(async () => { t = await createTestApp(); w = await listenWorld(t.app) })
afterAll(() => t.close())

const SLUG = /^[1-9A-HJ-NP-Za-km-z]{10}$/

describe('guests', () => {
  test('POST /api/guests sets a signed httpOnly gid cookie and returns the profile', async () => {
    const res = await w.http().post('/api/guests').send({ name: ' An ', avatar: 'cat' }).expect(201)
    expect(res.body.guest).toMatchObject({ name: 'An', avatar: 'cat' })
    expect(res.body.guest.id).toMatch(/^[0-9a-f]{32}$/)
    const cookie = String(res.headers['set-cookie'])
    expect(cookie).toMatch(/^gid=s%3A/)
    expect(cookie).toMatch(/HttpOnly/)
    expect(cookie).toMatch(/Expires=/)
  })

  test('forged gid is rejected, PATCH /me updates the profile', async () => {
    const g = await w.guest('Old')
    await w.http().patch('/api/guests/me').set('Cookie', `gid=${g.id}`).send({ name: 'Hack' }).expect(401)
    const res = await w.http().patch('/api/guests/me').set('Cookie', g.cookie).send({ name: 'New' }).expect(200)
    expect(res.body.guest.name).toBe('New')
  })
})

describe('rooms', () => {
  test('a guest cannot create a room', async () => {
    const g = await w.guest()
    await w.http().post('/api/rooms').set('Cookie', g.cookie).send({ name: 'x', scaleId: 'fibonacci' }).expect(401)
  })

  test('creates a room with an unguessable slug and never leaks secrets', async () => {
    const host = await w.user()
    const res = await w.http().post('/api/rooms').set('Cookie', host.cookie).send({ name: 'Sprint', scaleId: 'tshirt', password: 'secret' }).expect(201)
    expect(res.body.slug).toMatch(SLUG)
    expect(Object.keys(res.body)).toEqual(['slug'])
    const info = await w.http().get(`/api/rooms/${res.body.slug}`).expect(200)
    expect(info.body).toEqual({ name: 'Sprint', hasPassword: true, requireApproval: false, locked: false })
    const raw = JSON.stringify([res.body, info.body, (await w.http().get('/api/rooms/mine').set('Cookie', host.cookie)).body])
    expect(raw).not.toMatch(/passwordHash|liveState|argon2/)
  })

  test('validates input: unknown special, missing/both scale, bad custom scale', async () => {
    const host = await w.user()
    const post = (b: object) => w.http().post('/api/rooms').set('Cookie', host.cookie).send({ name: 'x', ...b })
    await post({ scaleId: 'fibonacci', enabledSpecials: ['coffee', 'nope'] }).expect(400)
    await post({}).expect(400)
    await post({ scaleId: 'fibonacci', customScale: { name: 'c', labels: ['a', 'b'] } }).expect(400)
    await post({ scaleId: 'nope' }).expect(400)
    const bad = await post({ customScale: { name: 'c', labels: ['a'] } }).expect(400)
    expect(bad.body.code).toBe('SCALE_TOO_SMALL')
    await post({ customScale: { name: 'c', labels: ['a', 'b'] }, enabledSpecials: ['coffee'], requireApproval: true }).expect(201)
  })

  test('GET /mine returns only my rooms; unknown slug is 404', async () => {
    const a = await w.user(), b = await w.user()
    const sa = await w.room(a), sb = await w.room(b)
    const mine = await w.http().get('/api/rooms/mine').set('Cookie', a.cookie).expect(200)
    expect(mine.body.rooms.map((r: { slug: string }) => r.slug)).toEqual([sa])
    expect(mine.body.rooms[0]).toMatchObject({ name: 'Sprint', itemsTotal: 0, itemsDone: 0 })
    expect(JSON.stringify(mine.body)).not.toContain(sb)
    await w.http().get('/api/rooms/mine').expect(401)
    await w.http().get('/api/rooms/1234567890').expect(404)
  })

  test('join: no identity 401; no password → 204 + signed rj_<slug>; wrong 403; correct 204', async () => {
    const host = await w.user()
    const open = await w.room(host)
    await w.http().post(`/api/rooms/${open}/join`).send({}).expect(401)
    const g = await w.guest()
    const ok = await w.http().post(`/api/rooms/${open}/join`).set('Cookie', g.cookie).send({}).expect(204)
    expect(String(ok.headers['set-cookie'])).toMatch(new RegExp(`^rj_${open}=s%3A`))

    const locked = await w.room(host, { password: 'hunter22' })
    const res403 = await w.http().post(`/api/rooms/${locked}/join`).set('Cookie', g.cookie).send({ password: 'nope' }).expect(403)
    expect(res403.body.code).toBe('WRONG_PASSWORD')
    await w.http().post(`/api/rooms/${locked}/join`).set('Cookie', g.cookie).send({}).expect(403)
    const good = await w.http().post(`/api/rooms/${locked}/join`).set('Cookie', g.cookie).send({ password: 'hunter22' }).expect(204)
    expect(String(good.headers['set-cookie'])).toContain(`rj_${locked}=`)
  })

  test('5 wrong passwords per room+IP in 10 minutes → 429, even for the right password; window slides', async () => {
    const host = await w.user()
    const slug = await w.room(host, { password: 'hunter22' })
    const g = await w.guest()
    const join = (password: string) => w.http().post(`/api/rooms/${slug}/join`).set('Cookie', g.cookie).send({ password })
    for (let i = 0; i < 5; i++) await join('bad').expect(403)
    const blocked = await join('hunter22').expect(429)
    expect(blocked.body.code).toBe('TOO_MANY_ATTEMPTS')
    t.clock.advance(10 * 60_000 + 1)
    await join('hunter22').expect(204)
  })

  test('PATCH is owner only and updates password/lock/approval', async () => {
    const owner = await w.user(), other = await w.user()
    const slug = await w.room(owner)
    await w.http().patch(`/api/rooms/${slug}`).send({ locked: true }).expect(401)
    await w.http().patch(`/api/rooms/${slug}`).set('Cookie', other.cookie).send({ locked: true }).expect(403)
    const res = await w.http().patch(`/api/rooms/${slug}`).set('Cookie', owner.cookie).send({ password: 'newpass1', locked: true, requireApproval: true }).expect(200)
    expect(res.body).toEqual({ name: 'Sprint', hasPassword: true, requireApproval: true, locked: true })
    expect((await w.http().get(`/api/rooms/${slug}`)).body).toEqual(res.body)
    const cleared = await w.http().patch(`/api/rooms/${slug}`).set('Cookie', owner.cookie).send({ password: null }).expect(200)
    expect(cleared.body.hasPassword).toBe(false)
    await w.http().patch(`/api/rooms/${slug}`).set('Cookie', owner.cookie).send({ bogus: 1 }).expect(400)
  })

  test('summary.csv is for room members only', async () => {
    const owner = await w.user(), other = await w.user()
    const slug = await w.room(owner)
    await w.http().get(`/api/rooms/${slug}/summary.csv`).expect(401)
    await w.http().get(`/api/rooms/${slug}/summary.csv`).set('Cookie', other.cookie).expect(403)
    const res = await w.http().get(`/api/rooms/${slug}/summary.csv`).set('Cookie', owner.cookie).expect(200)
    expect(res.headers['content-type']).toMatch(/text\/csv/)
    expect(res.headers['content-disposition']).toContain(`${slug}.csv`)
    expect(res.text).toContain('key,title,final,rounds,notes,special_cards')
  })
})
