import { PRESET_SCALES } from '../deck'
import { applyCommand, createRoom } from './apply'
import type { Command, CommandResult, CreateRoomOptions, DomainEvent, JoinInfo, Role, RoomState } from './types'

export const T0 = 1_000_000

export const user = (id: string, role: Role = 'voter'): JoinInfo => ({ id, userId: `user-${id}`, name: id, avatar: 'cat', role })
export const guest = (id: string, role: Role = 'voter'): JoinInfo => ({ id, userId: null, name: id, avatar: 'dog', role })

/** Room owned and hosted by registered user 'H' (a voter), Fibonacci scale, created at T0. */
export function room(opts: Partial<Pick<CreateRoomOptions, 'revealRule' | 'access' | 'enabledSpecials' | 'scale'>> = {}): RoomState {
  return createRoom({
    id: 'r1',
    owner: { id: 'H', userId: 'user-H', name: 'H', avatar: 'cat', role: 'voter' },
    scale: PRESET_SCALES.fibonacci,
    now: T0,
    ...opts,
  })
}

/** Applies commands in order at the same `now`, accumulating events. */
export function run(s: RoomState, cmds: Command[], now = T0): CommandResult {
  let state = s
  const events: DomainEvent[] = []
  for (const c of cmds) {
    const r = applyCommand(state, c, now)
    state = r.state
    events.push(...r.events)
  }
  return { state, events }
}
