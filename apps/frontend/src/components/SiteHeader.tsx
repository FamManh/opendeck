import { Link, useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { useTheme } from 'next-themes'
import { Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Mascot, isSpecies } from '@/components/game/Mascot'
import { LANGUAGES, isLanguage, setLanguage } from '@/i18n'
import { logout, useMe } from '@/lib/useMe'

/** `wordmark` hides the "Planning Poker" text below a breakpoint (default: phones only). */
export function Logo({ className = '', wordmark = 'max-sm:sr-only' }: { className?: string; wordmark?: string }) {
  return (
    <Link to="/" className={`flex items-center gap-2.5 ${className}`}>
      <span className="relative size-[30px]" aria-hidden="true">
        <span className="absolute top-1 left-0.5 h-6 w-[17px] -rotate-12 rounded-[5px] bg-stamp" />
        <span className="absolute top-0.5 left-[11px] h-6 w-[17px] rotate-[9deg] rounded-[5px] border-2 border-muted bg-primary" />
      </span>
      <span className={`text-[17px] font-[650] ${wordmark}`}>Planning Poker</span>
    </Link>
  )
}

export function ThemeToggle() {
  const { t } = useTranslation()
  const { resolvedTheme, setTheme } = useTheme()
  const dark = resolvedTheme === 'dark'
  return (
    <Button variant="ghost" size="icon" aria-label={dark ? t('app.themeLight') : t('app.themeDark')} onClick={() => setTheme(dark ? 'light' : 'dark')}>
      {dark ? <Sun /> : <Moon />}
    </Button>
  )
}

export function LanguageSelect() {
  const { t, i18n } = useTranslation()
  return (
    <Select value={i18n.language} onValueChange={v => { if (isLanguage(v)) setLanguage(v) }}>
      <SelectTrigger className="w-16 rounded-full border-0 bg-transparent px-2 sm:w-20 sm:px-3" aria-label={t('app.language')}><SelectValue /></SelectTrigger>
      <SelectContent>
        {LANGUAGES.map(l => <SelectItem key={l} value={l}>{l.toUpperCase()}</SelectItem>)}
      </SelectContent>
    </Select>
  )
}

export function SiteHeader() {
  const { t } = useTranslation()
  const { user } = useMe()
  const navigate = useNavigate()
  return (
    <header className="mx-auto mt-2 flex h-[60px] w-[calc(100%-16px)] max-w-[1200px] flex-none items-center gap-1 rounded-full bg-muted pr-2 pl-4 sm:mt-4 sm:gap-3 sm:pl-5">
      <Logo />
      <div className="flex-1" />
      <LanguageSelect />
      <ThemeToggle />
      {user ? (
        <>
          <Button variant="ghost" asChild className="max-sm:hidden"><Link to="/">{t('nav.myRooms')}</Link></Button>
          <span className="hidden h-11 items-center gap-2 rounded-full bg-background pr-4 pl-1.5 text-sm font-semibold sm:flex">
            <Mascot species={isSpecies(user.avatar) ? user.avatar : 'cat'} state="thinking" size={32} />
            {user.displayName}
          </span>
          <Button variant="secondary" className="max-sm:px-3" onClick={() => { void logout().then(() => navigate('/')) }}>{t('nav.logout')}</Button>
        </>
      ) : (
        <>
          <Button variant="ghost" asChild className="max-sm:px-2"><Link to="/login">{t('nav.login')}</Link></Button>
          <Button asChild className="max-sm:px-3"><Link to="/rooms/new">{t('nav.createRoom')}</Link></Button>
        </>
      )}
    </header>
  )
}
