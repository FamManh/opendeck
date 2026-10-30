import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Copy, Eye, Timer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/SiteHeader'
import type { Participant, PublicRoomState } from '@/domain'
import type { ClientCommand } from '@/store/roomStore'

export interface TopBarProps {
  name: string
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

export function TopBar({ name, state, me, isHost, send }: TopBarProps) {
  const { t } = useTranslation()
  const cur = state.current
  const left = useCountdown(cur?.status === 'voting' ? cur.deadline : null)
  const copy = () => {
    void navigator.clipboard?.writeText(window.location.href)
      .then(() => toast.success(t('room.linkCopied')))
      .catch(() => toast.error(t('errors.generic')))
  }
  return (
    <header className="mx-4 mt-3 flex min-h-[60px] flex-none flex-wrap items-center gap-2 rounded-full bg-muted py-2 pr-2 pl-5">
      <h1 className="min-w-0 flex-1 truncate text-base font-semibold">{name}</h1>
      {left !== null && (
        <span data-slot="timer" className="flex h-10 items-center gap-2 rounded-full bg-background px-4 text-sm font-semibold tabular-nums"><Timer className="size-4" />{Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}</span>
      )}
      <Button variant="outline" className="h-10 bg-background" onClick={copy}><Copy />{t('room.copyLink')}</Button>
      {me && (
        <Button
          variant="outline"
          className="h-10 bg-background"
          aria-pressed={me.role === 'observer'}
          onClick={() => void send({ type: 'setRole', target: me.id, role: me.role === 'observer' ? 'voter' : 'observer' }).catch(() => {})}
        ><Eye />{t(me.role === 'observer' ? 'room.becomeVoter' : 'room.becomeObserver')}</Button>
      )}
      {isHost && cur?.status === 'voting' && (
        <Button className="h-10" onClick={() => void send({ type: 'reveal' }).catch(() => {})}>{t('room.reveal')}</Button>
      )}
      <ThemeToggle />
    </header>
  )
}
