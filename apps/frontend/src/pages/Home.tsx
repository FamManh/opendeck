import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Lock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { SiteHeader } from '@/components/SiteHeader'
import { TableIllustration } from '@/components/TableIllustration'
import { api } from '@/lib/api'
import { useMe } from '@/lib/useMe'

export interface MyRoom {
  slug: string
  name: string
  hasPassword: boolean
  requireApproval: boolean
  locked: boolean
  createdAt: string
  itemsTotal: number
  itemsDone: number
}

/** Accepts a bare room code or a full invite link (`…/r/<slug>`). */
export function parseRoomCode(input: string): string {
  const v = input.trim()
  const m = /\/r\/([^/?#\s]+)/.exec(v)
  return m ? m[1]! : v.replace(/^\/+|\/+$/g, '')
}

export function HomePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user } = useMe()
  const [code, setCode] = useState('')
  const [rooms, setRooms] = useState<MyRoom[] | null>(null)

  useEffect(() => {
    if (!user) { setRooms(null); return }
    let live = true
    api.get<{ rooms: MyRoom[] }>('/rooms/mine').then(r => { if (live) setRooms(r.rooms) }).catch(() => { if (live) setRooms([]) })
    return () => { live = false }
  }, [user])

  function enter(e: FormEvent) {
    e.preventDefault()
    const slug = parseRoomCode(code)
    if (slug) navigate(`/r/${encodeURIComponent(slug)}`)
  }

  return (
    <div className="flex min-h-svh flex-col">
      <SiteHeader />
      <main className="mx-auto grid w-full max-w-[1200px] flex-1 items-center gap-10 px-4 py-8 lg:grid-cols-[minmax(0,1fr)_600px] lg:px-0">
        <div className="flex flex-col gap-7">
          <h1 className="text-[44px] leading-none sm:text-6xl lg:text-[80px]">{t('home.title')}</h1>
          <p className="max-w-[480px] text-lg leading-snug font-light text-muted-foreground sm:text-xl">{t('home.sub')}</p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button size="lg" asChild><Link to="/rooms/new">{t('home.createRoom')}</Link></Button>
            <form onSubmit={enter} className="flex h-14 items-center gap-1.5 rounded-xl bg-input pr-1.5 pl-4 sm:w-[340px]">
              <input
                aria-label={t('home.codeLabel')}
                value={code}
                onChange={e => setCode(e.target.value)}
                placeholder={t('home.codePlaceholder')}
                className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
              />
              <Button type="submit" variant="secondary" className="bg-foreground text-background hover:bg-foreground/80" disabled={!parseRoomCode(code)}>{t('home.enter')}</Button>
            </form>
          </div>
          <p className="text-sm text-muted-foreground">{t('home.note')}</p>
        </div>
        <div className="hidden justify-self-center lg:block"><TableIllustration /></div>
        <div className="mx-auto -mt-6 lg:hidden"><TableIllustration scale={0.58} /></div>
      </main>

      {user && (
        <section className="mx-auto w-full max-w-[1200px] px-4 pb-12 lg:px-0" aria-labelledby="my-rooms">
          <h2 id="my-rooms" className="mb-4 text-2xl">{t('home.myRooms')}</h2>
          {rooms && rooms.length === 0 && <p className="text-muted-foreground">{t('home.noRooms')}</p>}
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {rooms?.map(r => (
              <li key={r.slug}>
                <Link to={`/r/${r.slug}`} className="flex flex-col gap-2 rounded-3xl bg-muted p-5 transition-colors hover:bg-accent">
                  <span className="flex items-center gap-2 text-base font-[650]">
                    {r.name}
                    {r.hasPassword && <Lock className="size-3.5 text-muted-foreground" aria-label={t('home.hasPassword')} />}
                  </span>
                  <span className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    <Badge variant="outline">{t('home.itemsProgress', { done: r.itemsDone, total: r.itemsTotal })}</Badge>
                    {r.locked && <Badge variant="secondary">{t('home.locked')}</Badge>}
                    <span className="font-mono text-xs">{r.slug}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
