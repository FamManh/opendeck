import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { SiteHeader } from '@/components/SiteHeader'
import { api, ApiError } from '@/lib/api'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { useMe } from '@/lib/useMe'
import { useIsMobile } from '@/lib/useIsMobile'
import { useRoomStore } from '@/store/roomStore'
import { JoinDialog, type JoinedIdentity, type RoomPreview } from '@/room/JoinDialog'
import { useRoom } from '@/room/useRoom'
import { Table } from '@/room/Table'
import { CardFan } from '@/room/CardFan'
import { ResultsPanel } from '@/room/ResultsPanel'
import { RoomTabs } from '@/room/RoomTabs'
import { TopBar } from '@/room/TopBar'
import { PendingBar } from '@/room/PendingBar'
import { ReconnectBanner } from '@/room/ReconnectBanner'
import { AddItemsDialog } from '@/room/AddItemsDialog'

type Load = { state: 'loading' } | { state: 'missing' } | { state: 'error' } | { state: 'ready'; room: RoomPreview }

function Notice({ title, body }: { title: string; body?: string }) {
  const { t } = useTranslation()
  return (
    <div className="flex min-h-svh flex-col">
      <SiteHeader />
      <main className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
        <h1 className="text-3xl">{title}</h1>
        {body && <p className="text-muted-foreground">{body}</p>}
        <Button asChild><Link to="/">{t('room.backHome')}</Link></Button>
      </main>
    </div>
  )
}

/** Resolves our participant id (`u:<userId>` / `g:<guestId>`), which the server never sends back. */
function useOwnPid(active: boolean) {
  const { user, loading } = useMe()
  const setPid = useRoomStore(s => s.setPid)
  useEffect(() => {
    if (!active || loading) return
    if (user) { setPid(`u:${user.id}`); return }
    let live = true
    api.get<{ guest: { id: string } }>('/guests/me').then(r => { if (live) setPid(`g:${r.guest.id}`) }).catch(() => {})
    return () => { live = false }
  }, [active, loading, user, setPid])
}

function RoomView({ slug, name }: { slug: string; name: string }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const mobile = useIsMobile()
  const { state, me, isHost, send, connection } = useRoom()
  const pid = useRoomStore(s => s.pid)
  const lastEvents = useRoomStore(s => s.lastEvents)
  const connError = useRoomStore(s => s.connError)
  const [sheet, setSheet] = useState(false)
  const [addOpen, setAddOpen] = useState(false)

  if (connection === 'kicked') return <Notice title={t('room.kicked')} body={t('room.kickedNote')} />
  if (connError) return <Notice title={t('room.connError')} body={t(`errors.${connError}`, { defaultValue: t('errors.generic') })} />
  if (connection === 'pending') return <Notice title={t('room.pendingTitle')} body={t('room.pendingNote')} />
  if (!state) return <div className="flex min-h-svh items-center justify-center text-muted-foreground">{t('room.connecting')}</div>

  const cur = state.current
  const revealed = cur?.status === 'revealed'
  const canVote = me?.role === 'voter'
  const done = state.items.filter(i => i.status === 'done').length
  const nameOf = (id: string) => state.participants[id]?.name ?? '?'
  const ev = lastEvents.find(e => e.type === 'discussionNeeded')
  const stats = cur?.stats ?? null
  const discussion = (() => {
    if (!revealed || !stats?.needsDiscussion) return null
    if (ev?.type === 'discussionNeeded') return { low: ev.lowPids.map(nameOf), high: ev.highPids.map(nameOf) }
    const pick = (id: string | undefined) => Object.entries(cur?.votes ?? {}).filter(([, v]) => v === id).map(([p]) => nameOf(p))
    return { low: pick(stats.min?.id), high: pick(stats.max?.id) }
  })()
  const ignore = () => {}
  const openAdd = isHost ? () => setAddOpen(true) : undefined
  const tabs = <RoomTabs state={state} pid={pid} isHost={isHost} canVote={!!canVote} send={send} onAdd={openAdd} />

  return (
    <div className="flex h-svh flex-col bg-background">
      <ReconnectBanner />
      {isHost && <AddItemsDialog open={addOpen} onOpenChange={setAddOpen} onSubmit={items => send({ type: 'addItems', items })} />}
      <TopBar name={name} state={state} me={me} isHost={isHost} send={send} />
      {isHost && <PendingBar pending={state.pending} send={send} />}
      <div className="grid min-h-0 flex-1 md:grid-cols-[minmax(0,1fr)_340px]">
        <section className="flex min-h-0 flex-col gap-3 overflow-y-auto py-3">
          <div className="min-h-0 flex-1"><Table state={state} pid={pid} isHost={isHost} onStart={itemId => void send({ type: 'startRound', itemId }).catch(ignore)} onAdd={openAdd} onSummary={() => navigate(`/r/${slug}/summary`)} /></div>
          {cur?.status === 'voting' && canVote && (
            <CardFan scale={state.scale} enabledSpecials={state.enabledSpecials} myVote={cur.myVote} send={cmd => send(cmd).catch(ignore)} />
          )}
          {cur?.status === 'voting' && me?.role === 'observer' && <p className="text-center text-sm text-muted-foreground">{t('room.observing')}</p>}
          {revealed && stats && (
            <div className="mx-3 md:mx-6">
              <ResultsPanel
                stats={stats}
                scale={state.scale}
                isHost={isHost}
                discussion={discussion}
                onFinalize={value => void send({ type: 'finalize', value }).catch(ignore)}
                onRevote={() => void send({ type: 'revote' }).catch(ignore)}
              />
            </div>
          )}
        </section>
        {!mobile && <aside className="mr-4 mb-4 flex min-h-0 flex-col overflow-hidden rounded-3xl bg-muted">{tabs}</aside>}
      </div>
      {mobile && (
        <>
          <Button className="fixed right-4 bottom-4 z-20 h-12 min-w-12" aria-label={t('room.openPanel')} onClick={() => setSheet(true)}>{done}/{state.items.length}</Button>
          <Sheet open={sheet} onOpenChange={setSheet}>
            <SheetContent side="bottom" className="flex h-[80svh] flex-col gap-0 p-0">
              <SheetHeader className="sr-only"><SheetTitle>{t('room.openPanel')}</SheetTitle><SheetDescription>{name}</SheetDescription></SheetHeader>
              {tabs}
            </SheetContent>
          </Sheet>
        </>
      )}
    </div>
  )
}

/** Entry point for `/r/:slug`: preview → JoinDialog → live room over Socket.IO. */
export function RoomPage() {
  const { t } = useTranslation()
  const { slug = '' } = useParams()
  const [load, setLoad] = useState<Load>({ state: 'loading' })
  const [me, setMe] = useState<JoinedIdentity | null>(null)

  useEffect(() => {
    let live = true
    setLoad({ state: 'loading' })
    setMe(null)
    api.get<RoomPreview>(`/rooms/${encodeURIComponent(slug)}`)
      .then(room => { if (live) setLoad({ state: 'ready', room }) })
      .catch(e => { if (live) setLoad({ state: e instanceof ApiError && e.status === 404 ? 'missing' : 'error' }) })
    return () => { live = false }
  }, [slug])

  useOwnPid(!!me)
  useEffect(() => {
    if (!me) return
    useRoomStore.getState().connect(slug)
    return () => useRoomStore.getState().disconnect()
  }, [me, slug])

  if (load.state === 'loading') return null
  if (load.state !== 'ready') {
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
  if (me) return <RoomView slug={slug} name={load.room.name} />
  return (
    <div className="flex min-h-svh flex-col">
      <SiteHeader />
      <main className="flex-1" />
      <JoinDialog slug={slug} room={load.room} onJoined={setMe} />
    </div>
  )
}
