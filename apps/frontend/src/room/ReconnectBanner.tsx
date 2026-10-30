import { useTranslation } from 'react-i18next'
import { WifiOff } from 'lucide-react'
import { useRoom } from './useRoom'

export function ReconnectBanner() {
  const { t } = useTranslation()
  const { connection } = useRoom()
  if (connection !== 'reconnecting') return null
  return (
    <div role="alert" className="flex items-center justify-center gap-2 bg-warn px-4 py-2 text-sm font-semibold text-primary-foreground">
      <WifiOff className="size-4" />{t('room.reconnecting')}
    </div>
  )
}
