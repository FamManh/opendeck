import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AuthLayout, Field } from '@/components/AuthLayout'
import { api } from '@/lib/api'
import { errorMessage } from '@/lib/errors'

export function ForgotPage() {
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await api.post('/auth/forgot', { email: email.trim() })
      setSentTo(email.trim())
    } catch (err) {
      setError(errorMessage(t, err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout title={t('forgot.title')} subtitle={t('forgot.sub')}>
      <form onSubmit={submit} className="flex flex-col gap-6">
        <Field label={t('auth.email')} htmlFor="email">
          <Input id="email" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} />
        </Field>
        {sentTo && (
          <div role="status" className="flex gap-3 rounded-2xl bg-good/15 p-4">
            <span className="flex size-6 flex-none items-center justify-center rounded-full bg-good text-white"><Check className="size-3.5" strokeWidth={3.2} /></span>
            <p className="text-sm leading-snug">
              <b className="font-[650]">{t('forgot.sentTitle')}</b> {t('forgot.sentBody', { email: sentTo })}
            </p>
          </div>
        )}
        {error && <p role="alert" className="text-sm font-semibold text-warn">{error}</p>}
        <Button type="submit" size="lg" disabled={busy}>{sentTo ? t('forgot.resend') : t('forgot.send')}</Button>
        <Button variant="ghost" asChild><Link to="/login">{t('forgot.back')}</Link></Button>
      </form>
    </AuthLayout>
  )
}
