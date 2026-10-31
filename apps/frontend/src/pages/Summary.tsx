import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SiteHeader } from '@/components/SiteHeader'
import { Mascot, isSpecies } from '@/components/game/Mascot'
import { PokerCard } from '@/components/game/PokerCard'
import { buildSummary, type PublicRoomState, type RoomState } from '@/domain'
import { api, ApiError } from '@/lib/api'
import { JoinDialog, type JoinedIdentity, type RoomPreview } from '@/room/JoinDialog'
import { useRoomStore } from '@/store/roomStore'

type Load = { state: 'loading' } | { state: 'missing' } | { state: 'error' } | { state: 'ready'; room: RoomPreview }

/** Only a revealed current round counts towards the summary, and its votes are visible by then. */
function toSummaryState(s: PublicRoomState): RoomState {
  const cur = s.current
  return { ...s, current: cur?.status === 'revealed' ? { ...cur, votes: cur.votes ?? {} } : null }
}

function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="rounded-3xl bg-muted px-6 py-5">
      <div className="text-5xl leading-none font-[650]">{value}</div>
      <div className="mt-1.5 text-[15px] text-muted-foreground">{label}</div>
    </div>
  )
}

function SummaryView({ slug, name, state }: { slug: string; name: string; state: PublicRoomState }) {
  const { t } = useTranslation()
  const summary = useMemo(() => buildSummary(toSummaryState(state)), [state])
  const { totals, rows } = summary
  const crew = Object.values(state.participants).map(p => p.avatar).filter(isSpecies).slice(0, 7)
  const avg = totals.finalized ? (totals.rounds / totals.finalized).toFixed(1).replace(/\.0$/, '') : '0'
  const special = totals.mostUsedSpecial
  const specialName = special ? t(`cards.special.${special}`) : ''
  const revealedRounds = [...state.history, ...(state.current?.status === 'revealed' ? [{ votes: state.current.votes ?? {} }] : [])]
  const count = revealedRounds.flatMap(r => Object.values(r.votes)).filter(v => v === special).length

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col gap-4 px-4 pb-10 md:px-6">
        <section className="relative flex flex-col items-center gap-3.5 overflow-hidden rounded-3xl bg-felt px-5 pt-10 pb-28 text-center text-white md:pt-14 md:pb-32">
          <span className="rounded-full bg-primary px-3.5 py-1 text-[13px] font-[650] text-primary-foreground">{t('summary.badge')}</span>
          <h1 className="text-4xl leading-none font-[650] md:text-6xl">
            {totals.finalized === totals.items ? t('summary.heroDone', { done: totals.finalized }) : t('summary.heroPartial', { done: totals.finalized, total: totals.items })}
          </h1>
          <p className="text-lg font-light text-white/80 md:text-xl">{name}</p>
          <div className="absolute inset-x-0 -bottom-1.5 flex justify-center gap-2 md:gap-7">
            {crew.map((sp, i) => <div key={i} className="size-14 md:size-[92px]"><Mascot species={sp} state="celebrating" /></div>)}
          </div>
        </section>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
          <Stat value={totals.finalized} label={t('summary.tasks')} />
          <Stat value={totals.rounds} label={t('summary.rounds')} />
          <Stat value={Object.keys(state.participants).length} label={t('summary.people')} />
          <Stat value={avg} label={t('summary.avgRounds')} />
        </div>

        <div className="grid gap-3 md:grid-cols-[1.3fr_1fr] md:gap-4">
          <div className="flex items-center gap-[18px] rounded-3xl bg-muted px-6 py-5">
            {special ? (
              <>
                <div className="h-[102px] w-[72px] flex-none -rotate-6"><PokerCard value={special} /></div>
                <div>
                  <div className="text-[13px] font-semibold text-muted-foreground">{t('summary.special')}</div>
                  <div data-slot="special-name" className="mt-1 text-[22px] leading-tight font-[650]">{t('summary.specialCount', { name: specialName, count })}</div>
                </div>
              </>
            ) : <div className="text-[15px] text-muted-foreground">{t('summary.noSpecial')}</div>}
          </div>
          <div className="flex flex-col gap-2.5 rounded-3xl bg-muted px-6 py-5">
            <div className="text-[13px] font-semibold text-muted-foreground">{t('summary.saveTitle')}</div>
            <Button asChild size="lg" variant="secondary">
              <a href={`/api/rooms/${encodeURIComponent(slug)}/summary.csv`} download><Download />{t('summary.exportCsv')}</a>
            </Button>
          </div>
        </div>

        <section className="rounded-3xl bg-muted p-4 md:p-6">
          <h2 className="mb-3 text-lg font-[650]">{t('summary.results')}</h2>
          <table className="w-full text-left text-sm max-md:block">
            <thead className="text-[13px] text-muted-foreground max-md:sr-only">
              <tr><th className="py-2 font-semibold">{t('summary.colTask')}</th><th className="py-2 font-semibold">{t('summary.colFinal')}</th><th className="py-2 text-right font-semibold">{t('summary.colRounds')}</th><th className="py-2 pl-4 font-semibold">{t('summary.colNotes')}</th><th className="py-2 pl-4 font-semibold">{t('summary.colSpecial')}</th></tr>
            </thead>
            <tbody className="max-md:block">
              {rows.map((r, i) => (
                <tr key={i} data-slot="summary-row" className="border-t border-border align-top max-md:flex max-md:flex-wrap max-md:gap-x-4 max-md:gap-y-1 max-md:py-3">
                  <td className="py-2.5 pr-3 max-md:w-full max-md:p-0"><span className="mr-2 text-xs font-semibold text-muted-foreground">{r.key ?? ''}</span>{r.title}</td>
                  <td className="py-2.5 max-md:p-0"><span className="mr-1 text-xs text-muted-foreground md:hidden">{t('summary.colFinal')}</span><span data-slot="final" className="font-semibold">{r.final || t('summary.notFinal')}</span></td>
                  <td className="py-2.5 text-right max-md:p-0 max-md:text-left"><span className="mr-1 text-xs text-muted-foreground md:hidden">{t('summary.colRounds')}</span><span data-slot="rounds">{r.rounds}</span></td>
                  <td data-slot="notes" className="max-w-[320px] py-2.5 pl-4 text-[13px] whitespace-pre-line text-muted-foreground empty:hidden max-md:w-full max-md:max-w-none max-md:p-0">{r.notes}</td>
                  <td className="py-2.5 pl-4 max-md:w-full max-md:p-0">
                    <span data-slot="specials" className="flex flex-wrap gap-1">
                      {r.specialCards.map(c => <span key={c} title={t(`cards.special.${c}`)} className="h-[34px] w-6"><PokerCard value={c} compact instant /></span>)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <Button asChild variant="ghost" className="self-center"><Link to={`/r/${slug}`}>{t('summary.back')}</Link></Button>
      </main>
    </div>
  )
}

export function SummaryPage() {
  const { t } = useTranslation()
  const { slug = '' } = useParams()
  const [load, setLoad] = useState<Load>({ state: 'loading' })
  const [joined, setJoined] = useState<JoinedIdentity | null>(null)
  const state = useRoomStore(s => s.state)
  const connError = useRoomStore(s => s.connError)

  useEffect(() => {
    let live = true
    setLoad({ state: 'loading' })
    setJoined(null)
    api.get<RoomPreview>(`/rooms/${encodeURIComponent(slug)}`)
      .then(room => { if (live) setLoad({ state: 'ready', room }) })
      .catch(e => { if (live) setLoad({ state: e instanceof ApiError && e.status === 404 ? 'missing' : 'error' }) })
    return () => { live = false }
  }, [slug])

  useEffect(() => {
    if (!joined) return
    useRoomStore.getState().connect(slug)
    return () => useRoomStore.getState().disconnect()
  }, [joined, slug])

  if (load.state === 'loading') return null
  if (load.state !== 'ready' || connError) {
    return (
      <div className="flex min-h-svh flex-col">
        <SiteHeader />
        <main className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center gap-4 text-center">
          <h1 className="text-3xl">{t(load.state === 'missing' ? 'room.notFound' : 'errors.generic')}</h1>
          <Button asChild><Link to="/">{t('room.backHome')}</Link></Button>
        </main>
      </div>
    )
  }
  if (joined && state) return <SummaryView slug={slug} name={load.room.name} state={state} />
  return (
    <div className="flex min-h-svh flex-col">
      <SiteHeader />
      <main className="flex-1 p-8 text-center text-muted-foreground">{joined ? t('room.connecting') : null}</main>
      {!joined && <JoinDialog slug={slug} room={load.room} onJoined={setJoined} />}
    </div>
  )
}
