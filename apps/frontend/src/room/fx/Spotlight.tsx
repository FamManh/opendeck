import { useTranslation } from 'react-i18next'
import type { PublicRoomState } from '@/domain'
import { useFxStore } from '@/fx/runtime'
import { useRoomStore } from '@/store/roomStore'
import { Wheel } from './Wheel'

/** Caption + wheel shown while the plot twist is on: tone is encouraging, never an alarm. */
export function Spotlight({ state, isHost }: { state: PublicRoomState; isHost: boolean }) {
  const { t } = useTranslation()
  const moment = useFxStore(s => s.moment)
  const discussion = useFxStore(s => s.discussion)
  const spin = useFxStore(s => s.spin)
  const sendFx = useRoomStore(s => s.sendFx)
  if (moment !== 'twist' || !discussion) return null
  const nameOf = (pid: string) => state.participants[pid]?.name ?? '?'
  const join = (pids: string[]) => pids.map(nameOf).join(', ')
  return (
    <div data-slot="spotlight" className="animate-pp-spot pointer-events-none absolute inset-x-0 bottom-2 z-30 flex flex-col items-center gap-2">
      <p className="rounded-full bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground">
        {t('fx.speakFirst', { low: join(discussion.low), high: join(discussion.high) })}
      </p>
      <Wheel spin={spin} nameOf={nameOf} isHost={isHost} onSpin={() => void sendFx('fx:spin').catch(() => {})} />
    </div>
  )
}
