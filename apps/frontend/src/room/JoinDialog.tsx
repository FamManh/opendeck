import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Lock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Mascot, SPECIES, type Species } from '@/components/game/Mascot'
import { NAME_MAX } from '@/domain'
import { api, ApiError } from '@/lib/api'
import { loadGuest, saveGuest } from '@/lib/guest'
import { useMe } from '@/lib/useMe'

export interface RoomPreview { name: string; hasPassword: boolean }
export interface JoinedIdentity { kind: 'user' | 'guest'; name: string; avatar: string | null }

export interface JoinDialogProps {
  slug: string
  room: RoomPreview
  /** Called once the `rj_<slug>` ticket cookie is set; the Room page may open the socket now. */
  onJoined: (identity: JoinedIdentity) => void
}

type Step = 'auto' | 'form'

function useIsMobile(): boolean {
  const query = '(max-width: 767px)'
  const [mobile, setMobile] = useState(() => typeof window.matchMedia === 'function' && window.matchMedia(query).matches)
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia(query)
    const on = () => setMobile(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return mobile
}

export function JoinDialog({ slug, room, onJoined }: JoinDialogProps) {
  const { t } = useTranslation()
  const { user, loading } = useMe()
  const isMobile = useIsMobile()
  const saved = useRef(loadGuest()).current
  const knownIdentity = user !== null || saved !== null

  const [step, setStep] = useState<Step>('auto')
  const [name, setName] = useState(saved?.name ?? '')
  const [avatar, setAvatar] = useState<Species>(saved?.avatar ?? 'cat')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const triedAuto = useRef(false)

  const joinPath = `/rooms/${encodeURIComponent(slug)}/join`

  const join = useCallback(async (pw: string | undefined): Promise<void> => {
    await api.post<void>(joinPath, pw ? { password: pw } : {})
  }, [joinPath])

  const guestIdentity = useCallback(async (n: string, a: Species): Promise<JoinedIdentity> => {
    const { guest } = await api.post<{ guest: { name: string; avatar: string } }>('/guests', { name: n, avatar: a })
    saveGuest({ name: guest.name, avatar: a })
    return { kind: 'guest', name: guest.name, avatar: guest.avatar }
  }, [])

  // Known identity (account or saved guest profile): join straight away; only ask when a password is needed.
  useEffect(() => {
    if (loading || triedAuto.current) return
    triedAuto.current = true
    if (!knownIdentity) { setStep('form'); return }
    void (async () => {
      try {
        const identity: JoinedIdentity = user
          ? { kind: 'user', name: user.displayName, avatar: user.avatar }
          : await guestIdentity(saved!.name, saved!.avatar)
        await join(undefined)
        onJoined(identity)
      } catch (e) {
        if (e instanceof ApiError && e.code === 'WRONG_PASSWORD') setStep('form')
        else if (e instanceof ApiError && e.status === 429) { setError(t('join.tooMany')); setStep('form') }
        else { setError(t('join.error')); setStep('form') }
      }
    })()
  }, [loading, knownIdentity, user, saved, guestIdentity, join, onJoined, t])

  const trimmed = name.trim()
  const nameInvalid = trimmed.length === 0 || trimmed.length > NAME_MAX
  const needPassword = room.hasPassword
  const canSubmit = !busy && (user !== null || !nameInvalid) && (!needPassword || password.length > 0)

  async function submit(e?: React.FormEvent) {
    e?.preventDefault()
    if (!canSubmit) return
    setBusy(true)
    setError(null)
    try {
      const identity: JoinedIdentity = user
        ? { kind: 'user', name: user.displayName, avatar: user.avatar }
        : await guestIdentity(trimmed, avatar)
      await join(needPassword ? password : undefined)
      onJoined(identity)
    } catch (err) {
      if (err instanceof ApiError && err.code === 'WRONG_PASSWORD') setError(t('join.wrongPassword'))
      else if (err instanceof ApiError && err.status === 429) setError(t('join.tooMany'))
      else setError(t('join.error'))
    } finally {
      setBusy(false)
    }
  }

  if (loading || step === 'auto') return null

  const askIdentity = user === null && saved === null
  const form = (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <Badge variant="secondary" className="self-start">
        {needPassword && <Lock data-icon="inline-start" />}
        {needPassword ? t('join.passwordRoom') : t('join.publicRoom')}
      </Badge>

      {askIdentity && (
        <>
          <div className="flex flex-col gap-2">
            <Label htmlFor="join-name">{t('join.displayName')}</Label>
            <Input id="join-name" value={name} onChange={e => setName(e.target.value)} autoComplete="nickname" autoFocus aria-invalid={trimmed.length > NAME_MAX} />
            {trimmed.length > NAME_MAX && <p className="text-sm font-semibold text-warn">{t('join.nameTooLong', { max: NAME_MAX })}</p>}
          </div>
          <div className="flex flex-col gap-2">
            <Label id="join-avatar-label">{t('join.pickAvatar')}</Label>
            <div role="radiogroup" aria-labelledby="join-avatar-label" className="grid grid-cols-4 gap-2">
              {SPECIES.map(sp => (
                <button
                  key={sp}
                  type="button"
                  role="radio"
                  aria-checked={avatar === sp}
                  aria-label={t(`species.${sp}`)}
                  onClick={() => setAvatar(sp)}
                  className={`flex h-16 items-center justify-center rounded-2xl bg-muted outline-none focus-visible:ring-3 focus-visible:ring-ring/50 md:h-[72px] ${avatar === sp ? 'ring-2 ring-primary' : ''}`}
                >
                  <Mascot species={sp} state="thinking" size={48} />
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {needPassword && (
        <div className="flex flex-col gap-2">
          <Label htmlFor="join-password">{t('join.roomPassword')}</Label>
          <Input id="join-password" type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="off" autoFocus={!askIdentity} aria-invalid={error === t('join.wrongPassword')} />
        </div>
      )}

      {error && <p role="alert" className="text-sm font-semibold text-warn">{error}</p>}

      <Button type="submit" size="lg" disabled={!canSubmit}>
        {error ? t('join.retry') : t('join.submit')}
      </Button>
    </form>
  )

  const title = t('join.title', { name: room.name })
  const description = t('join.subtitle')
  if (isMobile) {
    return (
      <Sheet open onOpenChange={() => {}}>
        <SheetContent side="bottom" showCloseButton={false} className="px-4 pb-7" onInteractOutside={e => e.preventDefault()}>
          <SheetHeader className="p-0">
            <SheetTitle className="text-2xl">{title}</SheetTitle>
            <SheetDescription>{description}</SheetDescription>
          </SheetHeader>
          {form}
        </SheetContent>
      </Sheet>
    )
  }
  return (
    <Dialog open onOpenChange={() => {}}>
      <DialogContent showCloseButton={false} className="sm:max-w-[500px]" onInteractOutside={e => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="text-3xl">{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {form}
      </DialogContent>
    </Dialog>
  )
}
