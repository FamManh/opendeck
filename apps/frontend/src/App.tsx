import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PRESET_SCALES, deckOf, type Card } from '@/domain'
import { LANGUAGES, isLanguage, setLanguage } from '@/i18n'

export function App() {
  const { t, i18n } = useTranslation()
  const scale = PRESET_SCALES.fibonacci
  const cardLabel = (c: Card) => (c.special ? t(`cards.special.${c.id}`) : c.label)

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-8">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">{t('app.title')}</h1>
        <Select value={i18n.language} onValueChange={v => { if (isLanguage(v)) setLanguage(v) }}>
          <SelectTrigger className="w-28" aria-label={t('app.language')}><SelectValue /></SelectTrigger>
          <SelectContent>
            {LANGUAGES.map(l => <SelectItem key={l} value={l}>{l.toUpperCase()}</SelectItem>)}
          </SelectContent>
        </Select>
      </header>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t(`scales.${scale.id}`)}</h2>
        <ul className="flex flex-wrap gap-2">
          {deckOf(scale).map(c => <li key={c.id}><Button variant="outline">{cardLabel(c)}</Button></li>)}
        </ul>
      </section>
    </main>
  )
}
