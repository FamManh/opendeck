import { useMemo, useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { SiteHeader } from '@/components/SiteHeader'
import { PokerCard } from '@/components/game/PokerCard'
import { PRESET_SCALES, SPECIAL_IDS, type SpecialId } from '@/domain'
import { api } from '@/lib/api'
import { errorMessage } from '@/lib/errors'
import { useMe } from '@/lib/useMe'
import { TimerChips } from '@/room/TimerChips'

type PresetId = keyof typeof PRESET_SCALES
type DeckChoice = PresetId | 'custom'
const DECKS: DeckChoice[] = ['fibonacci', 'tshirt', 'hours', 'days', 'custom']
const ROOM_NAME_MAX = 80

export function parseLabels(raw: string): string[] {
  return raw.split(/[,\n]/).map(s => s.trim()).filter(Boolean)
}

export function CreateRoomPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user, loading } = useMe()
  const [name, setName] = useState('')
  const [deck, setDeck] = useState<DeckChoice>('fibonacci')
  const [customRaw, setCustomRaw] = useState('')
  const [specials, setSpecials] = useState<SpecialId[]>([...SPECIAL_IDS])
  const [usePassword, setUsePassword] = useState(false)
  const [password, setPassword] = useState('')
  const [requireApproval, setRequireApproval] = useState(false)
  const [timerSec, setTimerSec] = useState<number | null>(null)
  const [onAllVoted, setOnAllVoted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const labels = useMemo(() => (deck === 'custom' ? parseLabels(customRaw) : PRESET_SCALES[deck].cards.map(c => c.label)), [deck, customRaw])

  if (loading) return null
  if (!user) return <Navigate to="/login?next=%2Frooms%2Fnew" replace />

  const trimmed = name.trim()
  const valid = trimmed.length > 0 && trimmed.length <= ROOM_NAME_MAX && labels.length >= 2 && (!usePassword || password.length > 0)
  const toggleSpecial = (id: SpecialId) => setSpecials(s => (s.includes(id) ? s.filter(x => x !== id) : SPECIAL_IDS.filter(x => x === id || s.includes(x))))

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!valid || busy) return
    setBusy(true)
    setError(null)
    try {
      const { slug } = await api.post<{ slug: string }>('/rooms', {
        name: trimmed,
        ...(deck === 'custom' ? { customScale: { name: t('scales.custom'), labels } } : { scaleId: deck }),
        enabledSpecials: specials,
        ...(usePassword ? { password } : {}),
        requireApproval,
        revealRule: { onAllVoted, timerSec },
      })
      navigate(`/r/${slug}`)
    } catch (err) {
      setError(errorMessage(t, err))
    } finally {
      setBusy(false)
    }
  }

  const deckSummary = `${t(`scales.${deck}`)} · ${t('createRoom.deckCount', { cards: labels.length, specials: specials.length })}`

  return (
    <div className="flex min-h-svh flex-col">
      <SiteHeader />
      <form onSubmit={submit} className="mx-auto grid w-full max-w-[1200px] gap-8 px-4 py-9 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-12 lg:px-0">
        <div className="flex flex-col gap-6">
          <h1 className="text-4xl leading-[1.05] sm:text-[44px]">{t('createRoom.title')}</h1>

          <div className="flex flex-col gap-2">
            <Label htmlFor="room-name">{t('createRoom.name')}</Label>
            <Input id="room-name" value={name} maxLength={ROOM_NAME_MAX} onChange={e => setName(e.target.value)} placeholder={t('createRoom.namePlaceholder')} autoFocus />
          </div>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-[13px] font-semibold">{t('createRoom.deck')}</legend>
            <div role="radiogroup" className="grid grid-cols-2 gap-2.5 lg:grid-cols-5">
              {DECKS.map(d => (
                <button
                  key={d}
                  type="button"
                  role="radio"
                  aria-checked={deck === d}
                  onClick={() => setDeck(d)}
                  className={`flex flex-col gap-2.5 rounded-3xl p-4 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50 ${deck === d ? 'bg-background ring-2 ring-foreground' : 'bg-muted'}`}
                >
                  <span className="text-base font-[650]">{t(`scales.${d}`)}</span>
                  {d === 'custom' ? (
                    <span className="text-sm font-semibold text-muted-foreground">{t('createRoom.customHint')}</span>
                  ) : (
                    <span className="text-sm font-semibold text-muted-foreground">{PRESET_SCALES[d].cards.map(c => c.label).join(' · ')}</span>
                  )}
                </button>
              ))}
            </div>
            {deck === 'custom' && (
              <div className="mt-2 flex flex-col gap-2">
                <Label htmlFor="custom-labels">{t('createRoom.customLabels')}</Label>
                <Input id="custom-labels" value={customRaw} onChange={e => setCustomRaw(e.target.value)} placeholder={t('createRoom.customPlaceholder')} />
                <span className="text-[13px] text-muted-foreground">{t('createRoom.customNote')}</span>
              </div>
            )}
          </fieldset>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-[13px] font-semibold">{t('createRoom.specials')}</legend>
            <div className="flex flex-wrap gap-2.5">
              {SPECIAL_IDS.map(id => {
                const on = specials.includes(id)
                return (
                  <button key={id} type="button" aria-pressed={on} aria-label={t(`cards.special.${id}`)} onClick={() => toggleSpecial(id)} className="h-14 w-10 rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
                    <PokerCard value={id} compact dim={!on} instant />
                  </button>
                )
              })}
            </div>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <span className="text-[13px] font-semibold">{t('createRoom.access')}</span>
              <div className="flex rounded-xl bg-muted p-1" role="radiogroup">
                {([false, true] as const).map(pw => (
                  <button key={String(pw)} type="button" role="radio" aria-checked={usePassword === pw} onClick={() => setUsePassword(pw)} className={`h-11 flex-1 rounded-lg text-[15px] font-semibold ${usePassword === pw ? 'bg-background' : 'text-muted-foreground'}`}>
                    {t(pw ? 'createRoom.withPassword' : 'createRoom.public')}
                  </button>
                ))}
              </div>
            </div>
            {usePassword && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="room-password">{t('createRoom.roomPassword')}</Label>
                <Input id="room-password" type="password" autoComplete="new-password" maxLength={128} value={password} onChange={e => setPassword(e.target.value)} />
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <span id="create-timer" className="text-[13px] font-semibold">{t('createRoom.timer')}</span>
            <TimerChips labelledBy="create-timer" value={timerSec} onChange={setTimerSec} />
          </div>

          <div className="flex items-center gap-4 rounded-3xl bg-muted px-5 py-4">
            <div className="flex-1">
              <Label htmlFor="auto-reveal" className="text-[15px] font-[650]">{t('createRoom.autoReveal')}</Label>
              <p className="text-sm text-muted-foreground">{t('createRoom.autoRevealHint')}</p>
            </div>
            <Switch id="auto-reveal" checked={onAllVoted} onCheckedChange={setOnAllVoted} />
          </div>

          <div className="flex items-center gap-4 rounded-3xl bg-muted px-5 py-4">
            <div className="flex-1">
              <Label htmlFor="require-approval" className="text-[15px] font-[650]">{t('createRoom.requireApproval')}</Label>
              <p className="text-sm text-muted-foreground">{t('createRoom.requireApprovalHint')}</p>
            </div>
            <Switch id="require-approval" checked={requireApproval} onCheckedChange={setRequireApproval} />
          </div>
        </div>

        <aside className="flex flex-col gap-4 self-start rounded-3xl bg-muted p-6 lg:mt-[72px]">
          <span className="text-[13px] font-semibold text-muted-foreground">{t('createRoom.preview')}</span>
          <div className="rounded-full bg-border p-[7px]">
            <div className="relative flex h-[136px] items-center justify-center gap-1.5 rounded-full bg-felt">
              <div className="absolute inset-3 rounded-full border border-white/15" />
              {labels.slice(0, 5).map((l, i) => <div key={i} className="relative h-[42px] w-[30px]"><PokerCard value={l} compact instant /></div>)}
            </div>
          </div>
          <dl className="flex flex-col gap-2.5 text-sm">
            <Row k={t('createRoom.deck')} v={deckSummary} />
            <Row k={t('createRoom.access')} v={t(usePassword ? 'createRoom.withPassword' : 'createRoom.public')} />
            <Row k={t('createRoom.requireApprovalShort')} v={t(requireApproval ? 'createRoom.on' : 'createRoom.off')} />
          </dl>
          {error && <p role="alert" className="text-sm font-semibold text-warn">{error}</p>}
          <Button type="submit" size="lg" disabled={!valid || busy}>{t('createRoom.submit')}</Button>
          <Button type="button" variant="ghost" onClick={() => navigate('/')}>{t('common.cancel')}</Button>
        </aside>
      </form>
    </div>
  )
}

function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between gap-4"><dt className="text-muted-foreground">{k}</dt><dd className="text-right font-semibold">{v}</dd></div>
}
