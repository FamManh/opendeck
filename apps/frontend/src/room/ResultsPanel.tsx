import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PokerCard } from '@/components/game/PokerCard'
import { isSpecialId, type ConsensusLevel, type RoundStats, type Scale } from '@/domain'

export interface ResultsPanelProps {
  stats: RoundStats
  scale: Scale
  isHost: boolean
  /** Display names from the `discussionNeeded` event (lowest / highest voters). */
  discussion?: { low: string[]; high: string[] } | null
  onFinalize: (value: string) => void
  onRevote: () => void
}

const DOTS: Record<ConsensusLevel, number> = { absolute: 4, high: 3, medium: 2, low: 1, unknown: 0 }
const fmt = (n: number) => String(Math.round(n * 100) / 100)

function cardLabel(t: (k: string) => string, id: string, label: string) {
  return isSpecialId(id) ? t(`cards.special.${id}`) : label
}

export function ResultsPanel({ stats, scale, isHost, discussion, onFinalize, onRevote }: ResultsPanelProps) {
  const { t } = useTranslation()
  const [picked, setPicked] = useState<string | null>(null)
  const [custom, setCustom] = useState('')
  const value = custom.trim() || picked || stats.nearestCard?.id || stats.modes[0]?.id || ''
  const maxCount = Math.max(1, ...stats.distribution.map(d => d.count))
  const ordinal = scale.kind !== 'numeric'

  return (
    <div data-slot="results" className="flex flex-col gap-4 rounded-3xl bg-muted p-4 md:grid md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center md:gap-7 md:px-6">
      <div className="flex items-center gap-4">
        <div className="flex flex-col">
          {ordinal ? (
            <>
              <div className="text-[13px] font-semibold text-muted-foreground">{t('results.modes')}</div>
              <div data-slot="modes" className="text-4xl leading-none font-[650]">{stats.modes.map(c => cardLabel(t, c.id, c.label)).join(' · ') || '–'}</div>
            </>
          ) : (
            <>
              <div className="text-[13px] font-semibold text-muted-foreground">{t('results.average')}</div>
              <div data-slot="average" className="text-4xl leading-none font-[650]">{stats.average === null ? '–' : fmt(stats.average)}</div>
            </>
          )}
          <div className="text-[13px] text-muted-foreground">
            {stats.min && stats.max && (
              <>{t('results.min')} <b>{cardLabel(t, stats.min.id, stats.min.label)}</b> · {t('results.max')} <b>{cardLabel(t, stats.max.id, stats.max.label)}</b></>
            )}
          </div>
        </div>
        {!ordinal && stats.nearestCard && (
          <div className="flex flex-col items-center gap-1">
            <div className="h-[76px] w-[54px]"><PokerCard value={stats.nearestCard.id} compact /></div>
            <div className="text-xs font-semibold text-muted-foreground">{t('results.nearest')}</div>
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2.5">
          <span data-slot="consensus" className="rounded-full bg-background px-3 py-1 text-[13px] font-semibold">
            {t('results.consensus', { level: t(`results.level.${stats.consensusLevel}`) })}
          </span>
          <span className="flex gap-1" aria-hidden="true">
            {[0, 1, 2, 3].map(i => <span key={i} className={`size-2.5 rounded-full ${i < DOTS[stats.consensusLevel] ? 'bg-primary' : 'bg-border'}`} />)}
          </span>
          <span className="text-[13px] text-muted-foreground">{t('results.votes', { count: stats.total })}</span>
        </div>
        {stats.needsDiscussion && discussion && (
          <div data-slot="discussion" role="status" className="rounded-2xl bg-warn/20 px-3 py-2 text-sm font-semibold">
            {t('results.discussion', { low: discussion.low.join(', '), high: discussion.high.join(', ') })}
          </div>
        )}
        <ul data-slot="distribution" className="flex items-end gap-3.5 overflow-x-auto">
          {stats.distribution.map(d => (
            <li key={d.card.id} className="flex flex-none flex-col items-center gap-1">
              <span className="text-[13px] font-semibold" aria-label={t('results.count', { card: cardLabel(t, d.card.id, d.card.label), count: d.count })}>{d.count}</span>
              <div className={`w-7 rounded-t-lg rounded-b-sm transition-[transform] duration-300 ${d.count === maxCount ? 'bg-primary' : 'bg-muted-foreground/40'}`} style={{ height: `${Math.max(12, (d.count / maxCount) * 64)}px` }} />
              <div className="h-10 w-7"><PokerCard value={d.card.id} compact /></div>
            </li>
          ))}
        </ul>
      </div>

      {isHost && (
        <div className="flex flex-col gap-2.5 md:w-[340px]">
          <div className="text-[13px] font-semibold text-muted-foreground">{t('results.finalHint')}</div>
          <div className="flex flex-wrap gap-1.5">
            {scale.cards.map(c => (
              <button
                key={c.id}
                type="button"
                aria-pressed={!custom.trim() && value === c.id}
                onClick={() => { setPicked(c.id); setCustom('') }}
                className={`h-11 min-w-11 flex-1 rounded-full border-2 px-2 text-sm font-semibold ${!custom.trim() && value === c.id ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background'}`}
              >{c.label}</button>
            ))}
          </div>
          <Input value={custom} onChange={e => setCustom(e.target.value)} placeholder={t('results.customValue')} aria-label={t('results.customValue')} maxLength={20} />
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={onRevote}><RotateCcw />{t('results.revote')}</Button>
            <Button className="flex-[1.3]" disabled={!value} onClick={() => onFinalize(value)}>{t('results.finalize')}</Button>
          </div>
        </div>
      )}
    </div>
  )
}
