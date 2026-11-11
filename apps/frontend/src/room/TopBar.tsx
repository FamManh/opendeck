import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Copy, RotateCw, Timer } from 'lucide-react'
import { Logo } from '@/components/SiteHeader'
import { Button } from '@/components/ui/button'
import { FxSettingsSheet } from './fx/FxSettingsSheet'
import type { Participant, PublicRoomState } from '@/domain'
import { useIsMobile } from '@/lib/useIsMobile'
import type { ClientCommand } from '@/store/roomStore'
import { ParticipantsSheet } from './ParticipantsSheet'
import { RoomSettingsSheet } from './RoomSettingsSheet'

export interface TopBarProps {
  name: string
  slug: string
  hasPassword: boolean
  state: PublicRoomState
  me: Participant | null
  isHost: boolean
  send: (c: ClientCommand) => Promise<void>
}

function useCountdown(deadline: number | null): number | null {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (deadline === null) return
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [deadline])
  return deadline === null ? null : Math.max(0, Math.ceil((deadline - now) / 1000))
}

export function TopBar({ name, slug, hasPassword, state, me, isHost, send }: TopBarProps) {
  const { t } = useTranslation()
  const mobile = useIsMobile()
  const cur = state.current
  const left = useCountdown(cur?.status === 'voting' ? cur.deadline : null)
  const people = Object.values(state.participants)
  const voters = people.filter(p => p.role === 'voter' && p.online)
  const observers = people.length - people.filter(p => p.role === 'voter').length
  const copy = () => {
    void navigator.clipboard?.writeText(window.location.href)
      .then(() => toast.success(t('room.linkCopied')))
      .catch(() => toast.error(t('errors.generic')))
  }
  const timer = left !== null && (
    <span data-slot="timer" className="flex h-10 flex-none items-center gap-1.5 rounded-full bg-background px-3 text-sm font-semibold tabular-nums"><Timer className="size-4" />{Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}</span>
  )
  const menus = (
    <>
      <FxSettingsSheet />
      <ParticipantsSheet state={state} me={me} isHost={isHost} send={send} />
      <RoomSettingsSheet slug={slug} state={state} me={me} isHost={isHost} hasPassword={hasPassword} send={send} />
    </>
  )

  if (mobile) {
    return (
      <header className="mx-2 mt-2 flex h-14 flex-none items-center gap-1.5 rounded-full bg-muted py-1.5 pr-2 pl-4">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-semibold">{name}</h1>
          <button type="button" onClick={copy} className="flex max-w-full items-center gap-1 truncate text-xs text-muted-foreground"><Copy className="size-3 flex-none" />{t('room.copyLink')}</button>
        </div>
        {timer}
        {menus}
      </header>
    )
  }
  return (
    <header className="mx-4 mt-3 flex min-h-[60px] flex-none flex-wrap items-center gap-2 rounded-full bg-muted py-2 pr-2 pl-5">
      <Logo className="flex-none" />
      <div className="ml-2 min-w-0 flex-1">
        <h1 className="truncate text-sm font-semibold">{name}</h1>
        <div className="truncate text-xs text-muted-foreground">{t('room.peopleCount', { players: people.length - observers, observers })}</div>
      </div>
      <Button variant="outline" className="h-10 rounded-full bg-background font-mono text-xs" aria-label={t('room.copyLink')} title={t('room.copyLink')} onClick={copy}>{slug}<Copy /></Button>
      {timer}
      {cur?.status === 'voting' && <span data-slot="voted-count" className="flex h-10 flex-none items-center rounded-full bg-background px-3 text-sm font-semibold tabular-nums">{t('room.votedCount', { voted: cur.voted.length, total: voters.length })}</span>}
      {menus}
      {isHost && cur?.status === 'voting' && (
        <Button className="h-10 rounded-full" disabled={cur.voted.length === 0} onClick={() => void send({ type: 'reveal' }).catch(() => {})}><RotateCw />{t('room.reveal')}</Button>
      )}
    </header>
  )
}
