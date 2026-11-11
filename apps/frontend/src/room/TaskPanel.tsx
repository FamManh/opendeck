import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, ChevronDown, Pencil, Play, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PokerCard } from '@/components/game/PokerCard'
import type { Item, Outcome, Participant, Round } from '@/domain'

export interface TaskPanelProps {
  items: Item[]
  outcomes: Outcome[]
  currentItemId: string | null
  isHost: boolean
  onStart: (itemId: string) => void
  onAdd?: (() => void) | undefined
  onEdit?: ((item: Item) => void) | undefined
  onDelete?: ((itemId: string) => void) | undefined
  onSummary?: (() => void) | undefined
  /** Past rounds, for the per-task history. */
  history?: Round[] | undefined
  participants?: Record<string, Participant> | undefined
}

function RoundHistory({ rounds, participants }: { rounds: Round[]; participants: Record<string, Participant> }) {
  const { t } = useTranslation()
  return (
    <ol data-slot="round-history" className="flex flex-col gap-2 pt-1">
      {rounds.map(r => (
        <li key={r.number} className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-semibold text-muted-foreground">{t('room.round', { n: r.number })}</span>
            {r.stats?.distribution.map(d => (
              <span key={d.card.id} className="flex items-center gap-1 text-xs font-semibold">
                <span className="h-[28px] w-5"><PokerCard value={d.card.id} compact instant /></span>×{d.count}
              </span>
            ))}
          </div>
          {Object.entries(r.reasons).map(([pid, why]) => (
            <p key={pid} className="text-xs leading-snug"><b>{participants[pid]?.name ?? '?'}</b> · {why}</p>
          ))}
        </li>
      ))}
    </ol>
  )
}

export function TaskPanel({ items, outcomes, currentItemId, isHost, onStart, onAdd, onEdit, onDelete, onSummary, history = [], participants = {} }: TaskPanelProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState<string | null>(null)
  const done = items.filter(i => i.status === 'done').length
  const pct = items.length ? (done / items.length) * 100 : 0
  return (
    <div data-slot="task-panel" className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-col gap-2.5 px-5 pt-4 pb-3">
        <div className="flex items-center justify-between text-base font-semibold">
          <span>{t('room.tasksTitle')}</span>
          <span className="flex items-center gap-2">
            <span data-slot="progress-text">{done}<span className="text-muted-foreground">/{items.length}</span></span>
            {isHost && onAdd && (
              <Button size="icon" variant="secondary" aria-label={t('room.addTasks')} onClick={onAdd}><Plus /></Button>
            )}
          </span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-background"><div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${pct}%` }} /></div>
      </div>
      <ul className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-3 pb-3">
        {items.length === 0 && <li className="px-2 py-4 text-sm text-muted-foreground">{t('room.noItems')}</li>}
        {items.map(item => {
          const outcome = outcomes.find(o => o.itemId === item.id)
          const current = item.id === currentItemId
          const rounds = history.filter(r => r.itemId === item.id)
          const expanded = open === item.id
          return (
            <li key={item.id} data-status={item.status} aria-current={current ? 'true' : undefined} className={`flex flex-col rounded-xl px-2.5 py-2 ${current ? 'bg-background' : ''}`}>
              <div className="flex min-h-7 items-center gap-2">
                {item.status === 'done'
                  ? <span className="flex size-[22px] flex-none items-center justify-center rounded-full bg-good text-white"><Check className="size-3.5" strokeWidth={3.4} /></span>
                  : current
                    ? <span className="size-[22px] flex-none rounded-full border-[6px] border-primary" />
                    : <span className="size-[22px] flex-none rounded-full border border-border" />}
                <div className="min-w-0 flex-1">
                  {item.externalRef && <div className="text-xs font-semibold text-muted-foreground">{item.externalRef}</div>}
                  <div className="truncate text-sm" title={item.title}>{item.title}</div>
                </div>
                {outcome && <span data-slot="outcome" className="flex h-7 min-w-[30px] flex-none items-center justify-center rounded-md bg-primary px-2 text-[13px] font-semibold text-primary-foreground">{outcome.value}</span>}
                {rounds.length > 0 && (
                  <Button size="icon" variant="ghost" className="size-8" aria-expanded={expanded} aria-label={t('room.showHistory', { title: item.title })} onClick={() => setOpen(expanded ? null : item.id)}>
                    <ChevronDown className={`transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
                  </Button>
                )}
                {isHost && item.status === 'pending' && onEdit && (
                  <Button size="icon" variant="ghost" className="size-8" aria-label={t('addItems.editItem', { title: item.title })} onClick={() => onEdit(item)}><Pencil /></Button>
                )}
                {isHost && item.status === 'pending' && !current && rounds.length === 0 && onDelete && (
                  <Button size="icon" variant="ghost" className="size-8" aria-label={t('addItems.deleteItem', { title: item.title })} onClick={() => onDelete(item.id)}><Trash2 /></Button>
                )}
                {isHost && item.status === 'pending' && !current && (
                  <Button size="icon" variant="ghost" className="size-8" aria-label={t('room.startRound')} onClick={() => onStart(item.id)}><Play /></Button>
                )}
              </div>
              {expanded && <div className="pl-[30px]"><RoundHistory rounds={rounds} participants={participants} /></div>}
            </li>
          )
        })}
      </ul>
      {onSummary && done > 0 && done < items.length && <Button variant="ghost" className="mx-3 mb-2 flex-none" onClick={onSummary}>{t('room.viewSummary')}</Button>}
    </div>
  )
}
