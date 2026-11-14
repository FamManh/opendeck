import { useEffect } from 'react'
import { useLocation } from 'react-router'
import { useTranslation } from 'react-i18next'

const ORIGIN = 'https://deck.viconsol.net'

type PageKey = 'home' | 'login' | 'register' | 'forgot' | 'reset' | 'createRoom' | 'room' | 'summary'

/** Public, indexable pages. Everything else (rooms, password flows) is private and gets `noindex`. */
const PUBLIC: Record<string, PageKey> = { '/': 'home', '/login': 'login', '/register': 'register' }

export function pageFor(pathname: string): { key: PageKey; indexable: boolean } {
  const pub = PUBLIC[pathname]
  if (pub) return { key: pub, indexable: true }
  if (pathname === '/forgot') return { key: 'forgot', indexable: false }
  if (pathname === '/reset') return { key: 'reset', indexable: false }
  if (pathname === '/rooms/new') return { key: 'createRoom', indexable: false }
  if (/^\/r\/[^/]+\/summary\/?$/.test(pathname)) return { key: 'summary', indexable: false }
  if (/^\/r\/[^/]+\/?$/.test(pathname)) return { key: 'room', indexable: false }
  // Unknown paths render the home page; keep them out of the index to avoid duplicates.
  return { key: 'home', indexable: false }
}

function upsertMeta(selector: string, create: () => HTMLElement): HTMLElement {
  return document.head.querySelector<HTMLElement>(selector) ?? document.head.appendChild(create())
}

/** Syncs <title>, robots and canonical with the current route (the app is a client-rendered SPA). */
export function RouteMeta() {
  const { pathname } = useLocation()
  const { t, i18n } = useTranslation()
  const { key, indexable } = pageFor(pathname)

  useEffect(() => {
    document.title = `${t('app.title')} — ${t(`app.pageTitle.${key}`)}`
  }, [key, t, i18n.language])

  useEffect(() => {
    const robots = upsertMeta('meta[name="robots"]', () => Object.assign(document.createElement('meta'), { name: 'robots' }))
    robots.setAttribute('content', indexable ? 'index, follow' : 'noindex, nofollow')
    const canonical = upsertMeta('link[rel="canonical"]', () => Object.assign(document.createElement('link'), { rel: 'canonical' }))
    if (indexable) canonical.setAttribute('href', `${ORIGIN}${pathname}`)
    else canonical.remove()
  }, [pathname, indexable])

  return null
}
