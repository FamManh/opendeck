import { Inject, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common'
import {
  ConnectedSocket, MessageBody, SubscribeMessage, WebSocketGateway, WebSocketServer,
  type OnGatewayConnection, type OnGatewayDisconnect,
} from '@nestjs/websockets'
import type { Subscription } from 'rxjs'
import type { Namespace, Socket } from 'socket.io'
import { DomainError, toPublicState, type Command, type DomainEvent, type RoomState } from '../domain'
import { RoomStoreService, type RoomUpdate } from '../rooms/room-store.service'
import { CmdRateLimiter } from './cmd-rate-limiter'
import { FX_FLUSH_MS, FxService } from './fx.service'
import { WsAuthError, WsAuthService, type WsIdentity } from './ws-auth.service'

export type CmdAck = { ok: true } | { ok: false; code: string }

/** Lệnh client được phép gửi; join/disconnect/tick do server tự phát. */
const CLIENT_CMDS = new Set<Command['type']>([
  'rename', 'setRole', 'transferHost', 'setSuccessor', 'kick', 'approve', 'reject', 'setAccess',
  'addItems', 'startRound', 'vote', 'reveal', 'revote', 'reason', 'finalize',
  'setRevealRule', 'editItem', 'deleteItem', 'startSession', 'ask', 'answerQuestion', 'addNote',
])
const SERVER_ONLY = new Set(['join', 'disconnect', 'tick'])

type Data = WsIdentity & { pendingNotified?: boolean }
const dataOf = (s: Socket): Data | undefined => (s.data as Data).pid ? (s.data as Data) : undefined

@Injectable()
@WebSocketGateway({ namespace: '/room', cors: { origin: process.env.WEB_ORIGIN ?? false, credentials: true } })
export class RoomGateway implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit, OnModuleDestroy {
  @WebSocketServer() server: Namespace
  private sub: Subscription | undefined
  private readonly log = new Logger(RoomGateway.name)

  constructor(
    private readonly store: RoomStoreService,
    private readonly auth: WsAuthService,
    @Inject(CmdRateLimiter) private readonly limiter: CmdRateLimiter,
    private readonly fx: FxService,
  ) {}

  private readonly flushers = new Map<string, NodeJS.Timeout>()

  onModuleInit(): void {
    this.sub = this.store.events$.subscribe(u => this.broadcast(u))
  }

  onModuleDestroy(): void {
    this.sub?.unsubscribe()
    this.flushers.forEach(clearInterval)
    this.flushers.clear()
  }

  async handleConnection(socket: Socket): Promise<void> {
    let who: WsIdentity
    try {
      who = await this.auth.authenticate(socket)
    } catch (e) {
      return this.reject(socket, e instanceof WsAuthError ? e.code : 'UNAUTHENTICATED')
    }
    Object.assign(socket.data, who)
    await socket.join([who.slug, `pid:${who.pid}`])
    try {
      await this.store.dispatch(who.slug, { type: 'join', participant: { id: who.pid, userId: who.userId, name: who.name, avatar: who.avatar, role: 'voter' } })
    } catch (e) {
      this.reject(socket, e instanceof DomainError ? (e.code === 'KICKED' ? 'banned' : e.code) : 'INTERNAL')
    }
  }

  async handleDisconnect(socket: Socket): Promise<void> {
    this.limiter.forget(socket.id)
    const who = dataOf(socket)
    if (!who) return
    // Hai tab cùng một người: chỉ offline khi tab cuối đóng.
    if (await this.hasOtherSocket(who.pid, who.slug, socket.id)) return
    await this.store.dispatch(who.slug, { type: 'disconnect', pid: who.pid }).catch(e => {
      if (!(e instanceof DomainError)) this.log.error(String(e))
    })
  }

  @SubscribeMessage('cmd')
  async onCmd(@ConnectedSocket() socket: Socket, @MessageBody() body: unknown): Promise<CmdAck> {
    if (!this.limiter.allow(socket.id)) return { ok: false, code: 'RATE_LIMITED' }
    const who = dataOf(socket)
    if (!who) return { ok: false, code: 'NOT_READY' }
    const type = (body as { type?: unknown } | null)?.type
    if (typeof type !== 'string') return { ok: false, code: 'BAD_COMMAND' }
    if (SERVER_ONLY.has(type)) return { ok: false, code: 'FORBIDDEN_CMD' }
    if (!CLIENT_CMDS.has(type as Command['type'])) return { ok: false, code: 'UNKNOWN_CMD' }
    // pid luôn lấy từ danh tính đã xác thực, không tin giá trị client gửi.
    const cmd = { ...(body as object), pid: who.pid } as Command
    try {
      await this.store.dispatch(who.slug, cmd)
      return { ok: true }
    } catch (e) {
      if (e instanceof DomainError) return { ok: false, code: e.code }
      if (e instanceof TypeError) return { ok: false, code: 'BAD_COMMAND' }
      this.log.error(String(e))
      return { ok: false, code: 'INTERNAL' }
    }
  }

  @SubscribeMessage('fx:react')
  onReact(@ConnectedSocket() socket: Socket, @MessageBody() body: unknown): CmdAck {
    const who = dataOf(socket)
    if (!who) return { ok: false, code: 'NOT_READY' }
    const r = this.fx.react(who.slug, who.pid, (body as { emoji?: unknown } | null)?.emoji)
    if (!r.ok) return r
    this.scheduleFlush(who.slug)
    return { ok: true }
  }

  @SubscribeMessage('fx:throw')
  async onThrow(@ConnectedSocket() socket: Socket, @MessageBody() body: unknown): Promise<CmdAck> {
    const who = dataOf(socket)
    if (!who) return { ok: false, code: 'NOT_READY' }
    const b = (body ?? {}) as { target?: unknown; kind?: unknown }
    const state = await this.store.load(who.slug).catch(() => undefined)
    if (!state) return { ok: false, code: 'NOT_READY' }
    const r = this.fx.throwAt(who.slug, state, who.pid, b.target, b.kind)
    if (!r.ok) return r
    this.server.to(who.slug).emit('fx:thrown', { from: who.pid, target: b.target, kind: b.kind })
    return { ok: true }
  }

  @SubscribeMessage('fx:spin')
  async onSpin(@ConnectedSocket() socket: Socket): Promise<CmdAck> {
    const who = dataOf(socket)
    if (!who) return { ok: false, code: 'NOT_READY' }
    const state = await this.store.load(who.slug).catch(() => undefined)
    if (!state) return { ok: false, code: 'NOT_READY' }
    const r = this.fx.spin(who.slug, state, who.pid)
    if (!r.ok) return r
    this.server.to(who.slug).emit('fx:spun', r.value)
    return { ok: true }
  }

  /** Gộp reaction theo lô mỗi 250ms cho mỗi phòng; timer tự dừng khi không còn gì chờ. */
  private scheduleFlush(slug: string): void {
    if (this.flushers.has(slug)) return
    const timer = setInterval(() => {
      const items = this.fx.drain(slug)
      if (items.length === 0) { clearInterval(timer); this.flushers.delete(slug); return }
      this.server.to(slug).emit('fx:reactions', { items })
    }, FX_FLUSH_MS)
    timer.unref()
    this.flushers.set(slug, timer)
  }

  private reject(socket: Socket, code: string): void {
    socket.emit('conn:error', { code })
    socket.disconnect(true)
  }

  private async hasOtherSocket(pid: string, slug: string, selfId: string): Promise<boolean> {
    for (const s of this.server.sockets.values()) {
      const d = dataOf(s)
      if (s.id !== selfId && s.connected && d?.pid === pid && d.slug === slug) return true
    }
    return false
  }

  private broadcast({ slug, state, events }: RoomUpdate): void {
    const shared = events.filter(e => e.type !== 'approvalRequested')
    const views = new Map<string, unknown>()
    const view = (pid: string) => {
      if (!views.has(pid)) views.set(pid, toPublicState(state, pid))
      return views.get(pid)
    }
    for (const socket of this.server.sockets.values()) {
      const d = dataOf(socket)
      if (!d || d.slug !== slug) continue
      this.deliver(socket, d, state, events, shared, view)
    }
  }

  private deliver(socket: Socket, d: Data, state: RoomState, events: DomainEvent[], shared: DomainEvent[], view: (pid: string) => unknown): void {
    const own = events.find(e => (e.type === 'kicked' || e.type === 'rejected') && e.pid === d.pid)
    if (own) {
      socket.emit(own.type)
      socket.disconnect(true)
      return
    }
    if (state.participants[d.pid]) {
      d.pendingNotified = false
      socket.emit('state', view(d.pid))
      if (shared.length > 0) socket.emit('events', shared)
      if (state.hostId === d.pid) {
        for (const e of events) {
          if (e.type !== 'approvalRequested') continue
          socket.emit('approval:request', { pid: e.pid, name: e.name, avatar: state.pending[e.pid]?.avatar ?? null })
        }
      }
    } else if (state.pending[d.pid] && !d.pendingNotified) {
      d.pendingNotified = true
      socket.emit('approval:pending')
    }
  }
}
