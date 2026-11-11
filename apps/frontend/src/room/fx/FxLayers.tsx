import type { PublicRoomState } from '@/domain'
import { ConfettiLayer } from './ConfettiLayer'
import { CountdownOverlay } from './CountdownOverlay'
import { PaperPlaneLayer } from './PaperPlane'
import { ReactionLayer } from './ReactionLayer'
import { Spotlight } from './Spotlight'
import { Stamp } from './Stamp'
import { ThrowLayer } from './ThrowLayer'
import { BombLayer } from './BombLayer'

/** All per-device effect overlays; none of them intercept clicks except the wheel button. */
export function FxLayers({ state, isHost }: { state: PublicRoomState; isHost: boolean }) {
  return (
    <>
      <CountdownOverlay />
      <Stamp />
      <ConfettiLayer />
      <Spotlight state={state} isHost={isHost} />
      <ReactionLayer />
      <PaperPlaneLayer />
      <ThrowLayer />
      <BombLayer state={state} />
    </>
  )
}
