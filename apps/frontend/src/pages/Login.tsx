import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AuthLayout, Field } from '@/components/AuthLayout'
import { api } from '@/lib/api'
import { errorMessage } from '@/lib/errors'
import { useAuthStore, type User } from '@/lib/useMe'

export function safeNext(next: string | null): string {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/'
}

export function LoginPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const { user } = await api.post<{ user: User }>('/auth/login', { email, password })
      useAuthStore.getState().setUser(user)
      navigate(safeNext(params.get('next')), { replace: true })
    } catch (err) {
      setError(errorMessage(t, err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout title={t('auth.loginTitle')} subtitle={t('auth.loginSub')} tabs="login">
      <form onSubmit={submit} className="flex flex-col gap-6">
        <Field label={t('auth.email')} htmlFor="email">
          <Input id="email" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} />
        </Field>
        <Field label={t('auth.password')} htmlFor="password" aside={<Link to="/forgot" className="text-[13px] text-muted-foreground underline">{t('auth.forgotLink')}</Link>}>
          <Input id="password" type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} />
        </Field>
        {error && <p role="alert" className="text-sm font-semibold text-warn">{error}</p>}
        <Button type="submit" size="lg" disabled={busy}>{t('auth.loginBtn')}</Button>
        <p className="text-sm text-muted-foreground">
          {t('auth.justJoin')} <Link to="/" className="font-semibold text-foreground underline">{t('auth.joinByCode')}</Link>{t('auth.noAccountNeeded')}
        </p>
      </form>
    </AuthLayout>
  )
}
