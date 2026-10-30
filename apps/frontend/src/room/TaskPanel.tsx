import { useTranslation } from 'react-i18next'
import { Check, Play, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Item, Outcome } from '@/domain'

export interface TaskPanelProps {
  items: Item[]
  outcomes: Outcome[]
  currentItemId: string | null
  isHost: boolean
  onStart: (itemId: string) => void
  onAdd?: (() => void) | undefined
}

export function TaskPanel({ items, outcomes, currentItemId, isHost, onStart, onAdd }: TaskPanelProps) {
  const { t } = useTranslation()
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
          return (
            <li key={item.id} data-status={item.status} aria-current={current ? 'true' : undefined} className={`flex min-h-11 items-center gap-2.5 rounded-2xl px-2.5 py-2 ${current ? 'bg-background' : ''}`}>
              {item.status === 'done'
                ? <span className="flex size-[22px] flex-none items-center justify-center rounded-full bg-good text-white"><Check className="size-3.5" strokeWidth={3.4} /></span>
                : current
                  ? <span className="size-[22px] flex-none rounded-full border-[6px] border-primary" />
                  : <span className="size-[22px] flex-none rounded-full border border-border" />}
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-muted-foreground">{item.externalRef ?? item.id}</div>
                <div className="truncate text-sm">{item.title}</div>
              </div>
              {outcome && <span data-slot="outcome" className="flex h-7 min-w-[30px] flex-none items-center justify-center rounded-[9px] bg-primary px-2 text-[13px] font-semibold text-primary-foreground">{outcome.value}</span>}
              {isHost && item.status === 'pending' && !current && (
                <Button size="icon" variant="ghost" aria-label={t('room.startRound')} onClick={() => onStart(item.id)}><Play /></Button>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
