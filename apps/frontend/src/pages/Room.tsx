import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { SiteHeader } from '@/components/SiteHeader'
import { api, ApiError } from '@/lib/api'
import { JoinDialog, type JoinedIdentity, type RoomPreview } from '@/room/JoinDialog'

type Load = { state: 'loading' } | { state: 'missing' } | { state: 'error' } | { state: 'ready'; room: RoomPreview }

/**
 * Entry point for `/r/:slug`. Task 8 replaces the `joined` branch with the live table
 * (open the socket with `auth: { slug }` once JoinDialog calls `onJoined`).
 */
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
  return (
    <div className="flex min-h-svh flex-col">
      <SiteHeader />
      <main className="mx-auto flex flex-1 items-center justify-center px-4 text-center">
        {me && <p className="text-xl font-[650]">{t('room.joinedAs', { name: me.name })}</p>}
      </main>
      {!me && <JoinDialog slug={slug} room={load.room} onJoined={setMe} />}
    </div>
  )
}
