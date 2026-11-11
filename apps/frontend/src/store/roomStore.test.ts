import { toast } from 'sonner'
import i18n from '@/i18n'
import { PRESET_SCALES, createRoom, type PublicRoomState } from '@/domain'
import type { RoomSocket } from '@/realtime/socket'
import { useRoomStore } from './roomStore'

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

class FakeSocket implements RoomSocket {
  handlers: Record<string, ((...a: any[]) => void)[]> = {}
  emitted: { event: string; args: any[] }[] = []
  ackWith: unknown = { ok: true }
  on(event: string, h: (...a: any[]) => void) { (this.handlers[event] ??= []).push(h) }
  emit(event: string, ...args: any[]) {
    this.emitted.push({ event, args })
    const ack = args.at(-1)
    if (typeof ack === 'function') ack(this.ackWith)
  }
  disconnect() {}
  fire(event: string, ...a: any[]) { (this.handlers[event] ?? []).forEach(h => h(...a)) }
}

function publicState(name = 'Ann'): PublicRoomState {
  const state = createRoom({
    id: 'r', now: 0, scale: PRESET_SCALES.fibonacci,
    owner: { id: 'u:1', userId: '1', name, avatar: 'cat', role: 'voter' },
  })
  return { ...state, current: null }
}

let sock: FakeSocket
beforeEach(() => {
  sock = new FakeSocket()
  useRoomStore.getState().connect('slug', () => sock)
  vi.mocked(toast.error).mockClear()
})

test('a state frame replaces the whole state and goes online', () => {
  sock.fire('state', publicState('Ann'))
  sock.fire('state', publicState('Bob'))
  const { state, connection } = useRoomStore.getState()
  expect(Object.values(state!.participants).map(p => p.name)).toEqual(['Bob'])
  expect(connection).toBe('online')
})

test('kicked and approval:pending map to connection states', () => {
  sock.fire('approval:pending')
  expect(useRoomStore.getState().connection).toBe('pending')
  sock.fire('state', publicState())
  sock.fire('kicked')
  sock.fire('disconnect', 'io server disconnect')
  expect(useRoomStore.getState().connection).toBe('kicked')
})

test('a transport drop shows reconnecting until a new state arrives', () => {
  sock.fire('state', publicState())
  sock.fire('disconnect', 'transport close')
  expect(useRoomStore.getState().connection).toBe('reconnecting')
  sock.fire('state', publicState())
  expect(useRoomStore.getState().connection).toBe('online')
})

test('events frames are exposed as lastEvents', () => {
  sock.fire('events', [{ type: 'revealed', itemId: 'i1', number: 1, auto: false }])
  expect(useRoomStore.getState().lastEvents).toHaveLength(1)
})

test('send resolves on ok ack and emits cmd', async () => {
  await useRoomStore.getState().send({ type: 'vote', cardId: '5' })
  expect(sock.emitted[0]!.event).toBe('cmd')
  expect(sock.emitted[0]!.args[0]).toEqual({ type: 'vote', cardId: '5' })
})

test('send rejects on a failed ack and toasts the translated error', async () => {
  sock.ackWith = { ok: false, code: 'NOT_HOST' }
  await expect(useRoomStore.getState().send({ type: 'reveal' })).rejects.toThrow('NOT_HOST')
  expect(toast.error).toHaveBeenCalledWith(i18n.t('errors.NOT_HOST'))
})

test('leave resolves when the server says `left`, and a later disconnect is not a reconnect', async () => {
  sock.fire('state', publicState())
  sock.ackWith = undefined
  sock.emit = function (event: string, ...args: any[]) { this.emitted.push({ event, args }) }
  const p = useRoomStore.getState().leave()
  expect(sock.emitted.at(-1)?.args[0]).toEqual({ type: 'leave' })
  sock.fire('left')
  await expect(p).resolves.toBeUndefined()
  sock.fire('disconnect', 'io server disconnect')
  expect(useRoomStore.getState().connection).toBe('left')
  expect(toast.error).not.toHaveBeenCalled()
})

test('leave rejects with a toast when the server refuses', async () => {
  sock.ackWith = { ok: false, code: 'NOT_IN_ROOM' }
  await expect(useRoomStore.getState().leave()).rejects.toThrow('NOT_IN_ROOM')
  expect(toast.error).toHaveBeenCalled()
})

test('kicked without a ban remembers the room link still works', () => {
  sock.fire('state', publicState())
  sock.fire('kicked', { banned: false })
  expect(useRoomStore.getState()).toMatchObject({ connection: 'kicked', kickBanned: false })
})
