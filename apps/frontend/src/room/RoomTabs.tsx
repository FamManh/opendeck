import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { QNA_TEXT_MAX, REASON_MAX, type Item, type PublicRoomState } from '@/domain'
import type { ClientCommand } from '@/store/roomStore'
import { PokerCard } from '@/components/game/PokerCard'
import { TaskPanel } from './TaskPanel'

export interface RoomTabsProps {
  state: PublicRoomState
  pid: string | null
  isHost: boolean
  canVote: boolean
  send: (c: ClientCommand) => Promise<void>
  onStart: (itemId: string) => void
  onAdd?: (() => void) | undefined
  onEdit?: ((item: Item) => void) | undefined
  onSummary?: (() => void) | undefined
  /** Desktop keeps the task list above the tabs; phones have one panel with the tasks as a tab. */
  split?: boolean
}

function ReasonTab({ state, pid, canVote, send }: Pick<RoomTabsProps, 'state' | 'pid' | 'canVote' | 'send'>) {
  const { t } = useTranslation()
  const cur = state.current
  const mine = (pid && cur?.reasons[pid]) || ''
  const [text, setText] = useState(mine)
  useEffect(() => setText(mine), [mine, cur?.itemId, cur?.number])
  if (!cur) return <p className="p-4 text-sm text-muted-foreground">{t('room.noRound')}</p>
  const revealed = cur.status === 'revealed'
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (text.trim() !== mine) void send({ type: 'reason', text }).catch(() => {})
  }
  return (
    <div className="flex flex-col gap-3 p-4">
      {revealed && Object.entries(cur.reasons).map(([id, why]) => (
        <div key={id} className="flex gap-2.5 text-[13px] leading-normal">
          <div className="h-[31px] w-[22px] flex-none">{cur.votes?.[id] !== undefined && <PokerCard value={cur.votes[id]} compact />}</div>
          <div className="min-w-0 flex-1"><b>{state.participants[id]?.name ?? '?'}</b> · {why}</div>
        </div>
      ))}
      {revealed && Object.keys(cur.reasons).length === 0 && <p className="text-sm text-muted-foreground">{t('room.noReasons')}</p>}
      {canVote && (
        <form onSubmit={submit} className="flex flex-col gap-2">
          <Input
            value={text}
            onChange={e => setText(e.target.value)}
            maxLength={REASON_MAX}
            aria-label={t('room.reasonLabel')}
            placeholder={t(revealed ? 'room.reasonPlaceholderAfter' : 'room.reasonPlaceholder')}
          />
          <Button type="submit" variant="secondary" className="self-end" disabled={text.trim() === mine}>{t('room.reasonSave')}</Button>
        </form>
      )}
    </div>
  )
}

function Composer({ placeholder, label, onSend }: { placeholder: string; label: string; onSend: (text: string) => Promise<void> }) {
  const { t } = useTranslation()
  const [text, setText] = useState('')
  const submit = (e: FormEvent) => {
    e.preventDefault()
    const v = text.trim()
    if (!v) return
    onSend(v).then(() => setText('')).catch(() => {})
  }
  return (
    <form onSubmit={submit} className="flex flex-none items-center gap-2 px-4 pt-1 pb-3">
      <Input value={text} onChange={e => setText(e.target.value)} maxLength={QNA_TEXT_MAX} aria-label={label} placeholder={placeholder} />
      <Button type="submit" size="icon" aria-label={t('room.send')} disabled={!text.trim()}><Send /></Button>
    </form>
  )
}

function QuestionsTab({ state, pid, isHost, send }: Pick<RoomTabsProps, 'state' | 'pid' | 'isHost' | 'send'>) {
  const { t } = useTranslation()
  const itemId = state.current?.itemId
  if (!itemId) return <p className="p-4 text-sm text-muted-foreground">{t('room.noRound')}</p>
  const list = state.questions.filter(q => q.itemId === itemId)
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ul className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
        {list.length === 0 && <li className="text-sm text-muted-foreground">{t('room.noQuestions')}</li>}
        {list.map(q => {
          const canMark = isHost || q.pid === pid
          return (
            <li key={q.id} data-slot="question" className="flex flex-col gap-0.5 text-[13px] leading-normal">
              <div className="flex items-center gap-2">
                <b className="min-w-0 truncate">{state.participants[q.pid]?.name ?? t('room.formerMember')}</b>
                {q.answered && <span className="ml-auto flex-none text-xs font-semibold text-good">{t('room.answered')}</span>}
              </div>
              <p className="break-words">{q.text}</p>
              {canMark && (
                <button type="button" className="flex items-center gap-1 self-start text-xs font-semibold text-muted-foreground underline" onClick={() => void send({ type: 'answerQuestion', questionId: q.id, answered: !q.answered }).catch(() => {})}>
                  <Check className="size-3" />{t(q.answered ? 'room.markUnanswered' : 'room.markAnswered')}
                </button>
              )}
            </li>
          )
        })}
      </ul>
      <Composer label={t('room.askLabel')} placeholder={t('room.askPlaceholder')} onSend={text => send({ type: 'ask', text })} />
    </div>
  )
}

function NotesTab({ state, send }: Pick<RoomTabsProps, 'state' | 'send'>) {
  const { t } = useTranslation()
  const itemId = state.current?.itemId
  if (!itemId) return <p className="p-4 text-sm text-muted-foreground">{t('room.noRound')}</p>
  const list = state.notes.filter(n => n.itemId === itemId)
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ul className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
        {list.length === 0 && <li className="text-sm text-muted-foreground">{t('room.noNotes')}</li>}
        {list.map(n => (
          <li key={n.id} data-slot="note" className="text-[13px] leading-normal break-words"><b>{state.participants[n.pid]?.name ?? t('room.formerMember')}</b> · {n.text}</li>
        ))}
      </ul>
      <Composer label={t('room.noteLabel')} placeholder={t('room.notePlaceholder')} onSend={text => send({ type: 'addNote', text })} />
    </div>
  )
}

export function RoomTabs({ state, pid, isHost, canVote, send, onStart, onAdd, onEdit, onSummary, split = false }: RoomTabsProps) {
  const { t } = useTranslation()
  const done = state.items.filter(i => i.status === 'done').length
  const revealed = state.current?.status === 'revealed'
  const [tab, setTab] = useState(split ? 'questions' : 'tasks')
  // Reasons are what people want to read right after the cards turn over.
  useEffect(() => { if (revealed && split) setTab('reasons') }, [revealed, split])
  const taskPanel = (
    <TaskPanel
      items={state.items}
      outcomes={state.outcomes}
      currentItemId={state.current?.itemId ?? null}
      isHost={isHost}
      onStart={onStart}
      onAdd={onAdd}
      onEdit={onEdit}
      onDelete={isHost ? itemId => void send({ type: 'deleteItem', itemId }).catch(() => {}) : undefined}
      onSummary={onSummary}
      history={state.history}
      participants={state.participants}
    />
  )
  const counts: Record<string, number> = {
    questions: state.questions.filter(q => q.itemId === state.current?.itemId).length,
    notes: state.notes.filter(n => n.itemId === state.current?.itemId).length,
  }
  const label = (v: string): ReactNode => {
    if (v === 'tasks') return t('room.tabTasks', { done, total: state.items.length })
    return counts[v] ? `${t(`room.tab.${v}`)} (${counts[v]})` : t(`room.tab.${v}`)
  }
  const keys = split ? ['questions', 'notes', 'reasons'] : ['tasks', 'questions', 'notes', 'reasons']
  const tabs = (
    <Tabs value={tab} onValueChange={setTab} className="min-h-0 flex-1 gap-0">
      <TabsList className={`mt-3 ml-3 h-auto w-auto flex-none flex-wrap justify-start gap-1 rounded-3xl bg-background p-1 ${split ? 'mr-3' : 'mr-11'}`}>
        {keys.map(v => <TabsTrigger key={v} value={v} className="h-11 rounded-full px-3 text-[13px] font-semibold md:h-9">{label(v)}</TabsTrigger>)}
      </TabsList>
      {!split && <TabsContent value="tasks" className="flex min-h-0 flex-col">{taskPanel}</TabsContent>}
      <TabsContent value="questions" className="flex min-h-0 flex-col"><QuestionsTab state={state} pid={pid} isHost={isHost} send={send} /></TabsContent>
      <TabsContent value="notes" className="flex min-h-0 flex-col"><NotesTab state={state} send={send} /></TabsContent>
      <TabsContent value="reasons" className="overflow-y-auto"><ReasonTab state={state} pid={pid} canVote={canVote} send={send} /></TabsContent>
    </Tabs>
  )
  if (!split) return tabs
  return (
    <>
      <div className="flex min-h-0 flex-[1.1] flex-col">{taskPanel}</div>
      <div className="flex min-h-0 flex-1 flex-col border-t border-border">{tabs}</div>
    </>
  )
}
