import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AvatarPicker } from '@/components/game/AvatarPicker'
import { isSpecies, type Species } from '@/components/game/Mascot'
import { NAME_MAX, type Participant } from '@/domain'
import { api } from '@/lib/api'
import { errorMessage } from '@/lib/errors'
import { saveGuest } from '@/lib/guest'
import { useAuthStore, type User } from '@/lib/useMe'
import type { ClientCommand } from '@/store/roomStore'

export interface ProfileDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  me: Participant
  send: (c: ClientCommand) => Promise<void>
}

/** Saves to the identity first: `join` restores name and avatar from it, so a room-only rename would be lost on reload. */
export async function saveProfile(me: Participant, name: string, avatar: Species): Promise<void> {
  if (me.userId) {
    const { user } = await api.patch<{ user: User }>('/me', { displayName: name, avatar })
    useAuthStore.getState().setUser(user)
  } else {
    await api.patch('/guests/me', { name, avatar })
    saveGuest({ name, avatar })
  }
}

export function ProfileDialog({ open, onOpenChange, me, send }: ProfileDialogProps) {
  const { t } = useTranslation()
  const [name, setName] = useState(me.name)
  const [avatar, setAvatar] = useState<Species>(isSpecies(me.avatar) ? me.avatar : 'cat')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const trimmed = name.trim()

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!trimmed || busy) return
    setBusy(true)
    setError(null)
    try {
      await saveProfile(me, trimmed, avatar)
      await send({ type: 'rename', name: trimmed, avatar })
      onOpenChange(false)
    } catch (err) {
      setError(errorMessage(t, err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('profile.title')}</DialogTitle>
          <DialogDescription>{t('profile.sub')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="profile-name">{t('join.displayName')}</Label>
            <Input id="profile-name" value={name} maxLength={NAME_MAX} onChange={e => setName(e.target.value)} autoComplete="nickname" />
          </div>
          <div className="flex flex-col gap-2">
            <Label id="profile-avatar">{t('join.pickAvatar')}</Label>
            <AvatarPicker labelledBy="profile-avatar" value={avatar} onChange={setAvatar} />
          </div>
          {error && <p role="alert" className="text-sm font-semibold text-warn">{error}</p>}
          <Button type="submit" disabled={!trimmed || busy}>{t('profile.save')}</Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
