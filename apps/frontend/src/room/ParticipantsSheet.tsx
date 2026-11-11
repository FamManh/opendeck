import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Checkbox, DropdownMenu } from 'radix-ui'
import { Check, Crown, Ellipsis, Eye, LogOut, UserCheck, UserRoundX, Users, Vote, type LucideIcon } from 'lucide-react'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Mascot, isSpecies } from '@/components/game/Mascot'
import type { Participant, PublicRoomState } from '@/domain'
import { useIsMobile } from '@/lib/useIsMobile'
import { useRoomStore, type ClientCommand } from '@/store/roomStore'

export interface ParticipantsSheetProps {
  state: PublicRoomState
  me: Participant | null
  isHost: boolean
  send: (c: ClientCommand) => Promise<void>
}

const ITEM = 'flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm outline-none select-none data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50 data-[highlighted]:bg-muted [&_svg]:size-4 [&_svg]:flex-none'

function MenuItem({ icon: Icon, label, hint, disabled, danger, onSelect }: {
  icon: LucideIcon; label: string; hint?: string | undefined; disabled?: boolean; danger?: boolean; onSelect: () => void
}) {
  return (
    <DropdownMenu.Item disabled={disabled} onSelect={onSelect} className={`${ITEM} ${danger ? 'text-destructive data-[highlighted]:bg-destructive/10' : ''}`}>
      <Icon />
      <span className="min-w-0 flex-1">
        <span className="block">{label}</span>
        {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
      </span>
    </DropdownMenu.Item>
  )
}

/** Host actions for one person, behind a ⋯ button so the row keeps room for the name. */
function PersonMenu({ person: p, successor, onRole, onHost, onSuccessor, onKick }: {
  person: Participant; successor: boolean; onRole: () => void; onHost: () => void; onSuccessor: () => void; onKick: () => void
}) {
  const { t } = useTranslation()
  const guest = p.userId === null
  const needAccount = guest ? t('people.needAccount') : undefined
  return (
    // Non-modal: the kick confirm dialog opens right after the menu closes.
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger asChild>
        <Button size="icon" variant="ghost" data-slot="person-menu" aria-label={t('people.actions', { name: p.name })} title={t('people.actions', { name: p.name })} className="flex-none data-[state=open]:bg-background">
          <Ellipsis />
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={4}
          collisionPadding={12}
          className="z-50 w-60 rounded-xl bg-popover p-1 text-popover-foreground shadow-xl ring-1 ring-foreground/10 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
        >
          <MenuItem icon={p.role === 'observer' ? Vote : Eye} label={t(p.role === 'observer' ? 'people.menu.voter' : 'people.menu.observer')} onSelect={onRole} />
          <MenuItem icon={Crown} label={t('people.menu.host')} hint={needAccount} disabled={guest} onSelect={onHost} />
          <MenuItem icon={UserCheck} label={t(successor ? 'people.menu.unsuccessor' : 'people.menu.successor')} hint={needAccount} disabled={guest} onSelect={onSuccessor} />
          <DropdownMenu.Separator className="mx-1 my-1 h-px bg-border" />
          <MenuItem icon={UserRoundX} label={t('people.menu.kick')} danger onSelect={onKick} />
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}

export function ParticipantsSheet({ state, me, isHost, send }: ParticipantsSheetProps) {
  const { t } = useTranslation()
  const mobile = useIsMobile()
  const [kicking, setKicking] = useState<Participant | null>(null)
  /** Off by default: removing someone frees the seat, banning is an explicit extra. */
  const [ban, setBan] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const leave = useRoomStore(s => s.leave)
  const people = Object.values(state.participants).sort((a, b) => a.joinedAt - b.joinedAt)
  const run = (c: ClientCommand) => void send(c).catch(() => {})
  // Same rule as the server (nextHost): online registered successor, else earliest online registered user.
  const eligible = (p: Participant | undefined): p is Participant => !!p && p.online && p.userId !== null && p.id !== me?.id
  const successor = state.successorId ? state.participants[state.successorId] : undefined
  const heir = isHost ? (eligible(successor) ? successor : people.filter(eligible)[0]) : undefined
  const leaveBody = !isHost ? t('people.leaveBody') : heir ? t('people.leaveBodyHost', { name: heir.name }) : t('people.leaveBodyNoHost')

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
                    <PersonMenu
                      person={p}
                      successor={successor}
                      onRole={() => run({ type: 'setRole', target: p.id, role: p.role === 'observer' ? 'voter' : 'observer' })}
                      onHost={() => run({ type: 'transferHost', target: p.id })}
                      onSuccessor={() => run({ type: 'setSuccessor', target: successor ? null : p.id })}
                      onKick={() => { setBan(false); setKicking(p) }}
                    />
                  )}
                </li>
              )
            })}
          </ul>
          {me && (
            <Button variant="outline" data-slot="leave-room" className="mt-auto text-destructive hover:text-destructive" onClick={() => setLeaving(true)}>
              <LogOut />{t('people.leave')}
            </Button>
          )}
        </SheetContent>
      </Sheet>
      <ConfirmDialog
        open={kicking !== null}
        title={t('people.kickTitle', { name: kicking?.name ?? '' })}
        body={t(ban ? 'people.banBody' : 'people.kickBody')}
        confirmLabel={t(ban ? 'people.banConfirm' : 'people.kickConfirm')}
        onCancel={() => setKicking(null)}
        onConfirm={() => { if (kicking) run({ type: 'kick', target: kicking.id, ban }); setKicking(null) }}
      >
        <label className="flex cursor-pointer items-center gap-2.5 text-sm">
          <Checkbox.Root
            checked={ban}
            onCheckedChange={v => setBan(v === true)}
            data-slot="ban-checkbox"
            className="flex size-5 flex-none items-center justify-center rounded-md border border-input bg-background outline-none focus-visible:ring-3 focus-visible:ring-ring/50 data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
          >
            <Checkbox.Indicator><Check className="size-3.5" strokeWidth={3} /></Checkbox.Indicator>
          </Checkbox.Root>
          {t('people.banOption')}
        </label>
      </ConfirmDialog>
      <ConfirmDialog
        open={leaving}
        title={t('people.leaveTitle')}
        body={leaveBody}
        confirmLabel={t('people.leaveConfirm')}
        onCancel={() => setLeaving(false)}
        onConfirm={() => { setLeaving(false); void leave().catch(() => {}) }}
      />
    </>
  )
}
