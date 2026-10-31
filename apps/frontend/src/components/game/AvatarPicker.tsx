import { useTranslation } from 'react-i18next'
import { Mascot, SPECIES, type Species } from './Mascot'

export function AvatarPicker({ labelledBy, value, onChange }: { labelledBy: string; value: Species; onChange: (s: Species) => void }) {
  const { t } = useTranslation()
  return (
    <div role="radiogroup" aria-labelledby={labelledBy} className="grid grid-cols-4 gap-2">
      {SPECIES.map(sp => (
        <button
          key={sp}
          type="button"
          role="radio"
          aria-checked={value === sp}
          aria-label={t(`species.${sp}`)}
          onClick={() => onChange(sp)}
          className={`flex h-16 items-center justify-center rounded-2xl bg-muted outline-none focus-visible:ring-3 focus-visible:ring-ring/50 md:h-[72px] ${value === sp ? 'ring-2 ring-primary' : ''}`}
        >
          <Mascot species={sp} state="idle" size={48} />
        </button>
      ))}
    </div>
  )
}
