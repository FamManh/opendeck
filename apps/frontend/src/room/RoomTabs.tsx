import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { REASON_MAX, type PublicRoomState } from '@/domain'
import type { ClientCommand } from '@/store/roomStore'
import { PokerCard } from '@/components/game/PokerCard'
import { TaskPanel } from './TaskPanel'

export interface RoomTabsProps {
  state: PublicRoomState
  pid: string | null
  isHost: boolean
  canVote: boolean
  send: (c: ClientCommand) => Promise<void>
  onAdd?: (() => void) | undefined
}

function ReasonTab({ state, pid, canVote, send }: Pick<RoomTabsProps, 'state' | 'pid' | 'canVote' | 'send'>) {
  const { t } = useTranslation()
  const cur = state.current
  const mine = (pid && cur?.reasons[pid]) || ''
  const [text, setText] = useState(mine)
  useEffect(() => setText(mine), [mine, cur?.itemId, cur?.number])
  if (!cur) return <p className="p-4 text-sm text-muted-foreground">{t('room.noRound')}</p>
  const revealed = cur.status === 'revealed'
  return (
    <div className="flex flex-col gap-3 p-4">
      {canVote && !revealed && (
        <>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            maxLength={REASON_MAX}
            aria-label={t('room.reasonLabel')}
            placeholder={t('room.reasonPlaceholder')}
            className="min-h-20 resize-none rounded-2xl bg-input p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <Button variant="secondary" disabled={text.trim() === mine} onClick={() => void send({ type: 'reason', text }).catch(() => {})}>{t('room.reasonSave')}</Button>
        </>
      )}
      {revealed && Object.entries(cur.reasons).map(([id, why]) => (
        <div key={id} className="flex gap-2.5 text-[13px] leading-normal">
          <div className="h-[31px] w-[22px] flex-none">{cur.votes?.[id] !== undefined && <PokerCard value={cur.votes[id]} compact />}</div>
          <div className="min-w-0 flex-1"><b>{state.participants[id]?.name ?? '?'}</b> · {why}</div>
        </div>
      ))}
      {revealed && Object.keys(cur.reasons).length === 0 && <p className="text-sm text-muted-foreground">{t('room.noReasons')}</p>}
    </div>
  )
}

export function RoomTabs({ state, pid, isHost, canVote, send, onAdd }: RoomTabsProps) {
  const { t } = useTranslation()
  const done = state.items.filter(i => i.status === 'done').length
  return (
    <Tabs defaultValue="tasks" className="min-h-0 flex-1 gap-0">
      <TabsList className="mx-3 mt-3 h-auto w-auto flex-none flex-wrap justify-start gap-1 rounded-3xl bg-background p-1">
        {(['tasks', 'questions', 'notes', 'reasons'] as const).map(v => (
          <TabsTrigger key={v} value={v} className="h-11 rounded-full px-3 text-[13px] font-semibold md:h-9">
            {v === 'tasks' ? t('room.tabTasks', { done, total: state.items.length }) : t(`room.tab.${v}`)}
          </TabsTrigger>
        ))}
      </TabsList>
      <TabsContent value="tasks" className="flex min-h-0 flex-col">
        <TaskPanel
          items={state.items}
          outcomes={state.outcomes}
          currentItemId={state.current?.itemId ?? null}
          isHost={isHost}
          onStart={itemId => void send({ type: 'startRound', itemId }).catch(() => {})}
          onAdd={onAdd}
        />
      </TabsContent>
      <TabsContent value="questions"><p className="p-4 text-sm text-muted-foreground">{t('room.soon')}</p></TabsContent>
      <TabsContent value="notes"><p className="p-4 text-sm text-muted-foreground">{t('room.soon')}</p></TabsContent>
      <TabsContent value="reasons" className="overflow-y-auto"><ReasonTab state={state} pid={pid} canVote={canVote} send={send} /></TabsContent>
    </Tabs>
  )
}
