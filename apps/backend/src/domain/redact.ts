import type { Round, RoomState } from './room/types'

export interface PublicRound extends Omit<Round, 'votes' | 'reasons'> {
  voted: string[]
  myVote: string | null
  votes: Record<string, string> | null
  reasons: Record<string, string>
}
export type PublicRoomState = Omit<RoomState, 'current'> & { current: PublicRound | null }

/** The only shape that may leave the server: hides other people's votes/reasons until reveal (§6). */
export function toPublicState(s: RoomState, viewerPid: string): PublicRoomState {
  const { current, ...rest } = structuredClone(s)
  const isHost = s.hostId === viewerPid
  return {
    ...rest,
    pending: isHost ? rest.pending : {},
    banned: isHost ? rest.banned : [],
    current: current && publicRound(current, viewerPid),
  }
}

function publicRound(r: Round, viewer: string): PublicRound {
  const { votes, reasons, ...rest } = r
  const revealed = r.status === 'revealed'
  const own = reasons[viewer]
  return {
    ...rest,
    voted: Object.keys(votes),
    myVote: votes[viewer] ?? null,
    votes: revealed ? votes : null,
    reasons: revealed ? reasons : own === undefined ? {} : { [viewer]: own },
  }
}
