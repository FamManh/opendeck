import type { INestApplication } from '@nestjs/common'
import { io, type Socket } from 'socket.io-client'
import request from 'supertest'

let seq = 0

export interface World {
  http: () => request.Agent
  url: string
  cookiesOf(res: request.Response): string
  user(name?: string): Promise<{ id: string; pid: string; cookie: string }>
  guest(name?: string): Promise<{ id: string; pid: string; cookie: string }>
  room(host: { cookie: string }, body?: Record<string, unknown>): Promise<string>
  ticket(slug: string, who: { cookie: string }, password?: string): Promise<string>
  connect(slug: string, cookie: string): Promise<Peer>
}

export interface Frame { event: string; args: unknown[] }
export interface Peer {
  socket: Socket
  frames: Frame[]
  state(): any
  /** Chờ frame (kể cả đã đến trước đó chưa đọc) thoả điều kiện. */
  waitFor(event: string, pred?: (arg: any) => boolean, ms?: number): Promise<any>
  cmd(body: unknown): Promise<{ ok: boolean; code?: string }>
  close(): void
}

export async function listenWorld(app: INestApplication): Promise<World> {
  await app.listen(0)
  const server = app.getHttpServer()
  const url = `http://127.0.0.1:${server.address().port}`
  const http = () => request(server)
  const cookiesOf = (res: request.Response) =>
    ((res.headers['set-cookie'] as unknown as string[] | undefined) ?? []).map(c => c.split(';')[0]).join('; ')
  const join = (a: string, b: string) => [a, b].filter(Boolean).join('; ')

  const w: World = {
    http, url, cookiesOf,
    async user(name = `U${++seq}`) {
      const res = await http().post('/api/auth/register').send({ email: `u${++seq}-${Date.now()}@x.io`, password: 'password1', displayName: name }).expect(201)
      return { id: res.body.user.id, pid: `u:${res.body.user.id}`, cookie: cookiesOf(res) }
    },
    async guest(name = `G${++seq}`) {
      const res = await http().post('/api/guests').send({ name, avatar: 'dog' }).expect(201)
      return { id: res.body.guest.id, pid: `g:${res.body.guest.id}`, cookie: cookiesOf(res) }
    },
    async room(host, body = {}) {
      const res = await http().post('/api/rooms').set('Cookie', host.cookie).send({ name: 'Sprint', scaleId: 'fibonacci', ...body }).expect(201)
      return res.body.slug
    },
    async ticket(slug, who, password) {
      const res = await http().post(`/api/rooms/${slug}/join`).set('Cookie', who.cookie).send(password === undefined ? {} : { password }).expect(204)
      return join(who.cookie, cookiesOf(res))
    },
    connect(slug, cookie) {
      const socket = io(`${url}/room`, { auth: { slug }, extraHeaders: { cookie }, transports: ['websocket'], forceNew: true, reconnection: false })
      const frames: Frame[] = []
      const waiters: Array<() => void> = []
      socket.onAny((event, ...args) => { frames.push({ event, args }); waiters.splice(0).forEach(f => f()) })
      const peer: Peer = {
        socket, frames,
        state: () => frames.filter(f => f.event === 'state').at(-1)?.args[0],
        async waitFor(event, pred = () => true, ms = 3000) {
          const deadline = Date.now() + ms
          for (;;) {
            const hit = frames.find(f => f.event === event && pred(f.args[0]))
            if (hit) return hit.args[0]
            const left = deadline - Date.now()
            if (left <= 0) throw new Error(`timeout waiting for ${event}; got ${frames.map(f => f.event).join(',')}`)
            await new Promise<void>(r => { waiters.push(r); setTimeout(r, left) })
          }
        },
        cmd: body => new Promise(r => socket.emit('cmd', body, r)),
        close: () => { socket.close() },
      }
      socket.on('disconnect', () => waiters.splice(0).forEach(f => f()))
      // Chờ tới khi server trả lời đầu tiên hoặc đóng kết nối.
      return new Promise<Peer>(resolve => {
        const done = () => resolve(peer)
        for (const ev of ['state', 'approval:pending', 'conn:error', 'disconnect', 'connect_error']) socket.once(ev, done)
      })
    },
  }
  return w
}
