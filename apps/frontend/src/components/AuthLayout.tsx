import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Logo, LanguageSelect, ThemeToggle } from '@/components/SiteHeader'
import { TableIllustration } from '@/components/TableIllustration'

export function AuthLayout({ title, subtitle, tabs, children }: { title: string; subtitle: string; tabs?: 'login' | 'register'; children: ReactNode }) {
  const { t } = useTranslation()
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col px-6 py-8 sm:px-16 sm:py-10">
        <div className="flex items-center">
          <Logo />
          <div className="flex-1" />
          <LanguageSelect />
          <ThemeToggle />
        </div>
        <div className="mx-auto flex w-full max-w-[420px] flex-1 flex-col justify-center gap-6 py-8">
          <div className="flex flex-col gap-2.5">
            <h1 className="text-4xl leading-[1.05] sm:text-[44px]">{title}</h1>
            <p className="text-lg leading-snug font-light text-muted-foreground">{subtitle}</p>
          </div>
          {tabs && (
            <div className="flex rounded-xl bg-muted p-1" role="tablist">
              {(['login', 'register'] as const).map(k => (
                <Link
                  key={k}
                  to={`/${k}`}
                  role="tab"
                  aria-selected={tabs === k}
                  className={`flex h-10 flex-1 items-center justify-center rounded-lg text-[15px] font-semibold ${tabs === k ? 'bg-background' : 'text-muted-foreground'}`}
                >
                  {t(k === 'login' ? 'auth.tabLogin' : 'auth.tabRegister')}
                </Link>
              ))}
            </div>
          )}
          {children}
        </div>
        <p className="text-xs text-muted-foreground">{t('auth.footer')}</p>
      </div>
      <div className="m-4 hidden flex-col items-center justify-center gap-6 rounded-3xl bg-muted lg:flex">
        <TableIllustration celebrate />
        <div className="text-center">
          <p className="text-2xl leading-tight font-[650]">{t('auth.taglineTitle')}</p>
          <p className="mt-1 text-[17px] font-light text-muted-foreground">{t('auth.taglineSub')}</p>
        </div>
      </div>
    </div>
  )
}

export function Field({ label, htmlFor, children, aside }: { label: string; htmlFor: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <label htmlFor={htmlFor} className="text-[13px] font-semibold">{label}</label>
        {aside}
      </div>
      {children}
    </div>
  )
}
