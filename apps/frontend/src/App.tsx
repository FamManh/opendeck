import { useTranslation } from 'react-i18next'
import { PRESET_SCALES, deckOf, type Card } from './domain'
import { LANGUAGES, isLanguage, setLanguage } from './i18n'

export function App() {
  const { t, i18n } = useTranslation()
  const scale = PRESET_SCALES.fibonacci
  const cardLabel = (c: Card) => (c.special ? t(`cards.special.${c.id}`) : c.label)

  return (
    <main>
      <h1>{t('app.title')}</h1>
      <label>
        {t('app.language')}{' '}
        <select value={i18n.language} onChange={e => isLanguage(e.target.value) && setLanguage(e.target.value)}>
          {LANGUAGES.map(l => <option key={l} value={l}>{l.toUpperCase()}</option>)}
        </select>
      </label>
      <h2>{t(`scales.${scale.id}`)}</h2>
      <ul>{deckOf(scale).map(c => <li key={c.id}>{cardLabel(c)}</li>)}</ul>
    </main>
  )
}
