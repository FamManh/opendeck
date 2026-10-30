import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AuthLayout, Field } from '@/components/AuthLayout'
import { NAME_MAX } from '@/domain'
import { api } from '@/lib/api'
import { errorMessage } from '@/lib/errors'
import { useAuthStore, type User } from '@/lib/useMe'
import { safeNext } from './Login'

export function RegisterPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const { user } = await api.post<{ user: User }>('/auth/register', { email, password, displayName: displayName.trim() })
      useAuthStore.getState().setUser(user)
      navigate(safeNext(params.get('next')), { replace: true })
    } catch (err) {
      setError(errorMessage(t, err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout title={t('auth.registerTitle')} subtitle={t('auth.registerSub')} tabs="register">
      <form onSubmit={submit} className="flex flex-col gap-6">
        <Field label={t('auth.displayName')} htmlFor="displayName">
          <Input id="displayName" autoComplete="nickname" required maxLength={NAME_MAX} value={displayName} onChange={e => setDisplayName(e.target.value)} />
        </Field>
        <Field label={t('auth.email')} htmlFor="email">
          <Input id="email" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} />
        </Field>
        <Field label={t('auth.password')} htmlFor="password">
          <Input id="password" type="password" autoComplete="new-password" required minLength={8} value={password} onChange={e => setPassword(e.target.value)} />
          <span className="text-[13px] text-muted-foreground">{t('auth.passwordHint')}</span>
        </Field>
        {error && <p role="alert" className="text-sm font-semibold text-warn">{error}</p>}
        <Button type="submit" size="lg" disabled={busy}>{t('auth.registerBtn')}</Button>
        <p className="text-sm text-muted-foreground">
          {t('auth.haveAccount')} <Link to="/login" className="font-semibold text-foreground underline">{t('auth.tabLogin')}</Link>
        </p>
      </form>
    </AuthLayout>
  )
}
