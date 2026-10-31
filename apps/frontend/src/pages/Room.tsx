import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { ConfirmDialog } from '@/components/ConfirmDialog'
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
import { useFxStore } from '@/fx/runtime'
import { ReactionBar } from '@/room/fx/ReactionLayer'
import { TopBar } from '@/room/TopBar'
import { PendingBar } from '@/room/PendingBar'
import { ReconnectBanner } from '@/room/ReconnectBanner'
import { AddItemsDialog } from '@/room/AddItemsDialog'
import { EditItemDialog } from '@/room/EditItemDialog'
import { MobileActionBar, type MobileAction } from '@/room/MobileActionBar'
import type { Item } from '@/domain'

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

function RoomView({ slug, name, hasPassword }: { slug: string; name: string; hasPassword: boolean }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const mobile = useIsMobile()
  const { user } = useMe()
  const { state, me, isHost, send, connection } = useRoom()
  const pid = useRoomStore(s => s.pid)
  const lastEvents = useRoomStore(s => s.lastEvents)
  const connError = useRoomStore(s => s.connError)
  const hold = useFxStore(s => s.hold)
  const [sheet, setSheet] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [editing, setEditing] = useState<Item | null>(null)
  const [switchTo, setSwitchTo] = useState<string | null>(null)

  if (connection === 'kicked') return <Notice title={t('room.kicked')} body={t('room.kickedNote')} />
  if (connection === 'rejected') return <Notice title={t('room.rejected')} body={t('room.rejectedNote')} />
  if (connError) return <Notice title={t('room.connError')} body={t(`errors.${connError}`, { defaultValue: t('errors.generic') })} />
  if (connection === 'pending') return <Notice title={t('room.pendingTitle')} body={t('room.pendingNote')} />
  if (!state) return <div className="flex min-h-svh items-center justify-center text-muted-foreground">{t('room.connecting')}</div>

  const cur = state.current
  const revealed = cur?.status === 'revealed'
  const voting = cur?.status === 'voting'
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
  const openSummary = () => navigate(`/r/${slug}/summary`)
  const start = (itemId: string) => void send({ type: 'startRound', itemId }).catch(ignore)
  // Starting another task throws away the votes of a round that has not been revealed.
  const requestStart = (itemId: string) => {
    if (voting && cur.itemId !== itemId && cur.voted.length > 0) setSwitchTo(itemId)
    else start(itemId)
  }
  const reveal = () => void send({ type: 'reveal' }).catch(ignore)
  const next = state.items.find(i => i.status === 'pending')
  const tabs = (split: boolean) => (
    <RoomTabs state={state} pid={pid} isHost={isHost} canVote={!!canVote} send={send} onStart={requestStart} onAdd={openAdd} onEdit={isHost ? setEditing : undefined} onSummary={openSummary} split={split} />
  )
  const results = revealed && stats && !hold && (
    <div className="mx-3 flex-none md:mx-6">
      <ResultsPanel
        key={`${cur.itemId}:${cur.number}`}
        stats={stats}
        scale={state.scale}
        isHost={isHost}
        discussion={discussion}
        onFinalize={value => void send({ type: 'finalize', value }).catch(ignore)}
        onRevote={() => void send({ type: 'revote' }).catch(ignore)}
      />
    </div>
  )
  const table = <Table state={state} pid={pid} isHost={isHost} onStart={requestStart} onAdd={openAdd} onSummary={openSummary} />
  const fan = voting && canVote && <CardFan scale={state.scale} enabledSpecials={state.enabledSpecials} myVote={cur.myVote} send={cmd => send(cmd).catch(ignore)} />
  const observing = voting && me?.role === 'observer' && <p className="flex-none py-2 text-center text-sm text-muted-foreground">{t('room.observing')}</p>
  const mobileAction: MobileAction | null = (() => {
    if (voting) return isHost ? { label: t('room.reveal'), onClick: reveal, disabled: cur.voted.length === 0 } : null
    if (revealed) return null
    if (next) return isHost ? { label: t(state.outcomes.length ? 'room.startNext' : 'room.startRound'), onClick: () => start(next.id) } : null
    if (state.items.length === 0) return openAdd ? { label: t('room.addTasks'), onClick: openAdd } : null
    return { label: t('room.viewSummary'), onClick: openSummary }
  })()

  return (
    <div className="flex h-svh flex-col bg-background">
      <ReconnectBanner />
      {isHost && <AddItemsDialog open={addOpen} onOpenChange={setAddOpen} onSubmit={items => send({ type: 'addItems', items })} />}
      {editing && <EditItemDialog item={editing} onClose={() => setEditing(null)} send={send} />}
      <ConfirmDialog
        open={switchTo !== null}
        title={t('room.switchTitle')}
        body={t('room.switchBody')}
        confirmLabel={t('room.switchConfirm')}
        onCancel={() => setSwitchTo(null)}
        onConfirm={() => { if (switchTo) start(switchTo); setSwitchTo(null) }}
      />
      <TopBar name={name} slug={slug} hasPassword={hasPassword} state={state} me={me} isHost={isHost} send={send} />
      {isHost && <PendingBar pending={state.pending} send={send} />}
      {state.hostId === null && (
        <p data-slot="hostless" role="status" className="mx-4 mt-2 flex-none rounded-2xl bg-warn/20 px-4 py-2 text-sm font-semibold">
          {t(user ? 'room.hostlessClaim' : 'room.hostless')}
        </p>
      )}
      {mobile ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <section className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto py-2">
            {table}
            {results}
          </section>
          <div className="flex flex-none items-center justify-between gap-2 px-3 pt-1">
            <span className="text-[13px] font-semibold text-muted-foreground">{voting && canVote ? t('room.yourCards') : ''}</span>
            <ReactionBar />
          </div>
          {fan}
          {observing}
          <MobileActionBar done={done} total={state.items.length} onOpenPanel={() => setSheet(true)} action={mobileAction} />
          <Sheet open={sheet} onOpenChange={setSheet}>
            <SheetContent side="bottom" className="flex flex-col gap-0 p-0 data-[side=bottom]:h-[80svh]">
              <SheetHeader className="sr-only"><SheetTitle>{t('room.openPanel')}</SheetTitle><SheetDescription>{name}</SheetDescription></SheetHeader>
              {tabs(false)}
            </SheetContent>
          </Sheet>
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_340px]">
          <section className="flex min-h-0 flex-col gap-2 overflow-y-auto py-3">
            <div className="flex min-h-[320px] flex-1 items-stretch gap-3 pr-5 pl-4">
              <div className="flex flex-none items-center"><ReactionBar vertical /></div>
              <div className="min-w-0 flex-1">{table}</div>
            </div>
            {fan}
            {observing}
            {results}
          </section>
          <aside className="mr-4 mb-4 flex min-h-0 flex-col overflow-hidden rounded-3xl bg-muted">{tabs(true)}</aside>
        </div>
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
  if (me) return <RoomView slug={slug} name={load.room.name} hasPassword={load.room.hasPassword} />
  return (
    <div className="flex min-h-svh flex-col">
      <SiteHeader />
      <main className="flex-1" />
      <JoinDialog slug={slug} room={load.room} onJoined={setMe} />
    </div>
  )
}
