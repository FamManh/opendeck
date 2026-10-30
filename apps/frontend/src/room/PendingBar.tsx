import { useTranslation } from 'react-i18next'
import { Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { PendingJoin } from '@/domain'
import type { ClientCommand } from '@/store/roomStore'

export function PendingBar({ pending, send }: { pending: Record<string, PendingJoin>; send: (c: ClientCommand) => Promise<void> }) {
  const { t } = useTranslation()
  const list = Object.values(pending)
  if (list.length === 0) return null
  return (
    <ul className="mx-4 mt-2 flex flex-col gap-1.5">
      {list.map(p => (
        <li key={p.id} className="flex min-h-11 items-center gap-2 rounded-full bg-muted py-1 pr-1 pl-4 text-sm font-semibold">
          <span className="flex-1 truncate">{t('room.joinRequest', { name: p.name })}</span>
          <Button size="icon" variant="ghost" aria-label={t('room.approve')} onClick={() => void send({ type: 'approve', target: p.id }).catch(() => {})}><Check /></Button>
          <Button size="icon" variant="ghost" aria-label={t('room.reject')} onClick={() => void send({ type: 'reject', target: p.id }).catch(() => {})}><X /></Button>
        </li>
      ))}
    </ul>
  )
}
