import { useTranslation } from 'react-i18next'
import { ListChecks } from 'lucide-react'
import { Button } from '@/components/ui/button'

export interface MobileAction { label: string; onClick: () => void; disabled?: boolean }

export interface MobileActionBarProps {
  done: number
  total: number
  onOpenPanel: () => void
  action: MobileAction | null
}

export function MobileActionBar({ done, total, onOpenPanel, action }: MobileActionBarProps) {
  const { t } = useTranslation()
  return (
    <div data-slot="mobile-action-bar" className="flex h-[64px] flex-none items-center gap-2 border-t border-border bg-background px-3">
      <Button variant="secondary" className="h-11 w-[72px] flex-none" aria-label={t('room.openPanel')} onClick={onOpenPanel}><ListChecks />{done}/{total}</Button>
      {action && <Button className="h-11 flex-1" disabled={action.disabled} onClick={action.onClick}>{action.label}</Button>}
    </div>
  )
}
