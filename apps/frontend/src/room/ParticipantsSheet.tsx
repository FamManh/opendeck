import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Crown, Eye, UserCheck, UserRoundX, Users, Vote } from 'lucide-react'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Mascot, isSpecies } from '@/components/game/Mascot'
import type { Participant, PublicRoomState } from '@/domain'
import { useIsMobile } from '@/lib/useIsMobile'
import type { ClientCommand } from '@/store/roomStore'

export interface ParticipantsSheetProps {
  state: PublicRoomState
  me: Participant | null
  isHost: boolean
  send: (c: ClientCommand) => Promise<void>
}

export function ParticipantsSheet({ state, me, isHost, send }: ParticipantsSheetProps) {
  const { t } = useTranslation()
  const mobile = useIsMobile()
  const [kicking, setKicking] = useState<Participant | null>(null)
  const people = Object.values(state.participants).sort((a, b) => a.joinedAt - b.joinedAt)
  const run = (c: ClientCommand) => void send(c).catch(() => {})

  return (
    <>
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="outline" className="h-10 rounded-full bg-background px-3" aria-label={t('people.open')}><Users />{people.length}</Button>
        </SheetTrigger>
        <SheetContent side={mobile ? 'bottom' : 'right'} className="gap-3 overflow-y-auto p-5 data-[side=bottom]:max-h-[85svh] data-[side=right]:h-svh">
          <SheetHeader className="p-0">
            <SheetTitle>{t('people.title')}</SheetTitle>
            <SheetDescription>{isHost ? t('people.hostHint') : t('people.sub')}</SheetDescription>
          </SheetHeader>
          <ul className="flex flex-col gap-1.5">
            {people.map(p => {
              const self = p.id === me?.id
              const guest = p.userId === null
              const successor = state.successorId === p.id
              return (
                <li key={p.id} data-slot="person" data-pid={p.id} className={`flex min-h-14 items-center gap-2.5 rounded-xl bg-muted px-2.5 py-1.5 ${p.online ? '' : 'opacity-60'}`}>
                  <div className="size-9 flex-none"><Mascot species={isSpecies(p.avatar) ? p.avatar : 'cat'} state={p.online ? 'idle' : 'away'} /></div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{p.name}{self ? ` · ${t('room.you')}` : ''}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {[state.hostId === p.id && t('room.host'), successor && t('people.successor'), p.role === 'observer' ? t('room.status.observer') : t('people.voter'), !p.online && t('room.status.offline')].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                  {isHost && !self && (
                    <div className="flex flex-none gap-0.5">
                      <Button size="icon" variant="ghost" aria-label={t(p.role === 'observer' ? 'people.makeVoter' : 'people.makeObserver', { name: p.name })} title={t(p.role === 'observer' ? 'people.makeVoter' : 'people.makeObserver', { name: p.name })} onClick={() => run({ type: 'setRole', target: p.id, role: p.role === 'observer' ? 'voter' : 'observer' })}>
                        {p.role === 'observer' ? <Vote /> : <Eye />}
                      </Button>
                      <Button size="icon" variant="ghost" disabled={guest} aria-label={t('people.makeHost', { name: p.name })} title={guest ? t('people.needAccount') : t('people.makeHost', { name: p.name })} onClick={() => run({ type: 'transferHost', target: p.id })}><Crown /></Button>
                      <Button size="icon" variant="ghost" disabled={guest} aria-pressed={successor} aria-label={t('people.makeSuccessor', { name: p.name })} title={guest ? t('people.needAccount') : t('people.makeSuccessor', { name: p.name })} className={successor ? 'text-primary' : ''} onClick={() => run({ type: 'setSuccessor', target: successor ? null : p.id })}><UserCheck /></Button>
                      <Button size="icon" variant="ghost" aria-label={t('people.kick', { name: p.name })} title={t('people.kick', { name: p.name })} onClick={() => setKicking(p)}><UserRoundX /></Button>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </SheetContent>
      </Sheet>
      <ConfirmDialog
        open={kicking !== null}
        title={t('people.kickTitle', { name: kicking?.name ?? '' })}
        body={t('people.kickBody')}
        confirmLabel={t('people.kickConfirm')}
        onCancel={() => setKicking(null)}
        onConfirm={() => { if (kicking) run({ type: 'kick', target: kicking.id }); setKicking(null) }}
      />
    </>
  )
}
