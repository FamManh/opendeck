import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Mascot, isSpecies } from '@/components/game/Mascot'
import { PokerCard } from '@/components/game/PokerCard'
import type { PublicRoomState } from '@/domain'
import { useFxPrefs } from '@/fx/prefs'
import { fxRuntime, useFxStore } from '@/fx/runtime'
import { useIsMobile } from '@/lib/useIsMobile'
import { useRoomStore } from '@/store/roomStore'
import { Wheel } from './Wheel'

function Hero({ state, pids, side, still }: { state: PublicRoomState; pids: string[]; side: 'low' | 'high'; still: boolean }) {
  const { t } = useTranslation()
  const first = state.participants[pids[0] ?? '']
  const stats = state.current?.stats
  const card = side === 'low' ? stats?.min : stats?.max
  if (!first || !card) return <div />
  return (
    <div data-spot-hero={side} className="relative flex flex-col items-center gap-1 text-white">
      <div
        aria-hidden
        className={`pointer-events-none absolute -top-16 left-1/2 h-[140%] w-40 -translate-x-1/2 bg-gradient-to-b from-primary to-transparent [clip-path:polygon(40%_0,60%_0,100%_100%,0_100%)] md:w-56 short:-top-8 short:w-36 ${still ? 'opacity-55' : 'animate-pp-cone'}`}
      />
      <div className="relative size-12 md:size-16 short:size-10"><Mascot species={isSpecies(first.avatar) ? first.avatar : 'cat'} state="voted" /></div>
      <div className={`relative h-28 w-20 md:h-40 md:w-28 short:h-24 short:w-[68px] ${still ? '' : 'animate-pp-spot'}`}><PokerCard value={card.id} instant /></div>
      <div className="relative max-w-28 truncate text-sm font-semibold md:max-w-40">{pids.map(p => state.participants[p]?.name ?? '?').join(', ')}</div>
      <div className="relative rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap">{t(side === 'low' ? 'results.min' : 'results.max')} · {card.label}</div>
    </div>
  )
}

/** Plot twist: a stage for the two extremes, framed as worth discussing rather than as an alarm. Starts only from the event, never from a snapshot. */
export function Spotlight({ state, isHost }: { state: PublicRoomState; isHost: boolean }) {
  const { t } = useTranslation()
  const mobile = useIsMobile()
  const { effective } = useFxPrefs()
  const moment = useFxStore(s => s.moment)
  const discussion = useFxStore(s => s.discussion)
  const spin = useFxStore(s => s.spin)
  const sendFx = useRoomStore(s => s.sendFx)
  if (moment !== 'twist' || !discussion) return null
  const nameOf = (pid: string) => state.participants[pid]?.name ?? '?'
  const join = (pids: string[]) => pids.map(nameOf).join(', ')
  const still = effective === 'minimal'
  return (
    <div
      data-slot="spotlight"
      role="status"
      className={`z-40 flex flex-col items-center justify-center-safe gap-3 overflow-x-hidden overflow-y-auto bg-[oklch(0.2_0.02_260/0.94)] p-4 text-center short:gap-2 short:p-3 ${mobile ? 'fixed inset-0' : 'absolute inset-0 rounded-3xl'} ${still ? '' : 'animate-pp-fade'}`}
    >
      <span className="relative z-10 rounded-full bg-primary px-3 py-1 text-xs font-[650] text-primary-foreground">{t('fx.twistBadge')}</span>
      <h2 className="relative z-10 max-w-xl text-2xl leading-tight font-[650] text-white md:text-3xl short:max-w-2xl short:text-xl">{t('fx.twistTitle', { low: join(discussion.low), high: join(discussion.high) })}</h2>
      <div className="grid w-full max-w-2xl grid-cols-2 items-end gap-4">
        <Hero state={state} pids={discussion.low} side="low" still={still} />
        <Hero state={state} pids={discussion.high} side="high" still={still} />
      </div>
      <p className="relative max-w-lg text-sm text-white/80 short:hidden">{t('fx.twistBody')}</p>
      <div className="relative flex flex-wrap items-center justify-center gap-2.5">
        <Wheel spin={spin} nameOf={nameOf} isHost={isHost} onSpin={() => void sendFx('fx:spin').catch(() => {})} />
        <Button variant="outline" className="border-white/40 bg-transparent text-white hover:bg-white/10 hover:text-white" onClick={() => fxRuntime.dismissTwist()}>{t('fx.viewResults')}</Button>
      </div>
    </div>
  )
}
