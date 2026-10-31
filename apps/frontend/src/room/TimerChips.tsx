import { useTranslation } from 'react-i18next'

const OPTIONS: (number | null)[] = [null, 60, 120, 180, 300]

export function TimerChips({ value, onChange, labelledBy }: { value: number | null; onChange: (sec: number | null) => void; labelledBy: string }) {
  const { t } = useTranslation()
  // A timer set outside the presets (e.g. through the API) still shows as selected.
  const options = value === null || OPTIONS.includes(value) ? OPTIONS : [...OPTIONS, value]
  return (
    <div role="radiogroup" aria-labelledby={labelledBy} className="flex flex-wrap gap-1.5">
      {options.map(sec => (
        <button
          key={sec ?? 'off'}
          type="button"
          role="radio"
          aria-checked={value === sec}
          onClick={() => onChange(sec)}
          className={`h-10 rounded-full border-2 px-3 text-sm font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring/50 ${value === sec ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background'}`}
        >{sec === null ? t('createRoom.off') : t('createRoom.minutes', { n: Math.round((sec / 60) * 10) / 10 })}</button>
      ))}
    </div>
  )
}
