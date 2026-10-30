import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AuthLayout, Field } from '@/components/AuthLayout'
import { api } from '@/lib/api'
import { errorMessage } from '@/lib/errors'

export function ResetPage() {
  const { t } = useTranslation()
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const [password, setPassword] = useState('')
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await api.post('/auth/reset', { token, password })
      setDone(true)
    } catch (err) {
      setError(errorMessage(t, err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout title={t('reset.title')} subtitle={t('reset.sub')}>
      {!token ? (
        <p role="alert" className="text-sm font-semibold text-warn">{t('reset.missingToken')}</p>
      ) : done ? (
        <div className="flex flex-col gap-6">
          <div role="status" className="flex gap-3 rounded-2xl bg-good/15 p-4">
            <span className="flex size-6 flex-none items-center justify-center rounded-full bg-good text-white"><Check className="size-3.5" strokeWidth={3.2} /></span>
            <p className="text-sm font-[650]">{t('reset.done')}</p>
          </div>
          <Button size="lg" asChild><Link to="/login">{t('auth.loginBtn')}</Link></Button>
        </div>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-6">
          <Field label={t('reset.newPassword')} htmlFor="password">
            <Input id="password" type="password" autoComplete="new-password" required minLength={8} value={password} onChange={e => setPassword(e.target.value)} />
            <span className="text-[13px] text-muted-foreground">{t('auth.passwordHint')}</span>
          </Field>
          {error && <p role="alert" className="text-sm font-semibold text-warn">{error}</p>}
          <Button type="submit" size="lg" disabled={busy}>{t('reset.submit')}</Button>
        </form>
      )}
    </AuthLayout>
  )
}
