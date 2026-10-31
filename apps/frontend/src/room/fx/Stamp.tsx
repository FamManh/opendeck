import { useTranslation } from 'react-i18next'
import { useFxPrefs } from '@/fx/prefs'
import { useFxStore } from '@/fx/runtime'

export function Stamp() {
  const { t } = useTranslation()
  const on = useFxStore(s => s.stamp)
  const { effective } = useFxPrefs()
  if (!on) return null
  return (
    <div data-slot="stamp" aria-hidden className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
      <span className={`${effective === 'minimal' ? 'animate-pp-fade' : 'animate-pp-stamp'} rounded-2xl border-4 border-stamp px-5 py-1 text-3xl font-bold tracking-wide text-stamp uppercase`}>
        {t('fx.stamp')}
      </span>
    </div>
  )
}
