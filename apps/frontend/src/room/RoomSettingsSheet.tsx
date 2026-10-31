import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useTheme } from 'next-themes'
import { Eye, Moon, Settings2, Sun, UserRoundPen, Vote } from 'lucide-react'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { LanguageSelect } from '@/components/SiteHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Switch } from '@/components/ui/switch'
import type { Participant, PublicRoomState } from '@/domain'
import { api } from '@/lib/api'
import { errorMessage } from '@/lib/errors'
import { useIsMobile } from '@/lib/useIsMobile'
import type { ClientCommand } from '@/store/roomStore'
import { ProfileDialog } from './ProfileDialog'
import { TimerChips } from './TimerChips'

export interface RoomSettingsSheetProps {
  slug: string
  state: PublicRoomState
  me: Participant | null
  isHost: boolean
  hasPassword: boolean
  send: (c: ClientCommand) => Promise<void>
}

function PasswordSection({ slug, hasPassword }: { slug: string; hasPassword: boolean }) {
  const { t } = useTranslation()
  const [enabled, setEnabled] = useState(hasPassword)
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const save = async (value: string | null) => {
    setMsg(null)
    try {
      await api.patch(`/rooms/${encodeURIComponent(slug)}`, { password: value })
      setEnabled(value !== null)
      setPassword('')
      setMsg(t(value === null ? 'settings.passwordRemoved' : 'settings.passwordSaved'))
    } catch (err) {
      setMsg(errorMessage(t, err))
    }
  }
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="settings-password">{t(enabled ? 'settings.changePassword' : 'settings.setPassword')}</Label>
      <div className="flex gap-2">
        <Input id="settings-password" type="password" autoComplete="new-password" maxLength={128} value={password} onChange={e => setPassword(e.target.value)} />
        <Button variant="secondary" disabled={!password} onClick={() => void save(password)}>{t('profile.save')}</Button>
      </div>
      {enabled && <Button variant="ghost" className="self-start" onClick={() => void save(null)}>{t('settings.removePassword')}</Button>}
      {msg && <p role="status" className="text-[13px] text-muted-foreground">{msg}</p>}
    </div>
  )
}

export function RoomSettingsSheet({ slug, state, me, isHost, hasPassword, send }: RoomSettingsSheetProps) {
  const { t } = useTranslation()
  const mobile = useIsMobile()
  const { resolvedTheme, setTheme } = useTheme()
  const [profile, setProfile] = useState(false)
  const [newSession, setNewSession] = useState(false)
  const dark = resolvedTheme === 'dark'
  const run = (c: ClientCommand) => void send(c).catch(() => {})
  const owner = !!me?.userId && me.userId === state.ownerId

  return (
    <>
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="outline" size="icon" className="size-10 bg-background" aria-label={t('settings.open')}><Settings2 /></Button>
        </SheetTrigger>
        <SheetContent side={mobile ? 'bottom' : 'right'} className="gap-4 overflow-y-auto p-5 data-[side=bottom]:max-h-[85svh] data-[side=right]:h-svh">
          <SheetHeader className="p-0">
            <SheetTitle>{t('settings.title')}</SheetTitle>
            <SheetDescription className="sr-only">{t('settings.title')}</SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-2">
            {me && <Button variant="secondary" className="justify-start" onClick={() => setProfile(true)}><UserRoundPen />{t('profile.title')}</Button>}
            {me && (
              <Button variant="secondary" className="justify-start" aria-pressed={me.role === 'observer'} onClick={() => run({ type: 'setRole', target: me.id, role: me.role === 'observer' ? 'voter' : 'observer' })}>
                {me.role === 'observer' ? <Vote /> : <Eye />}{t(me.role === 'observer' ? 'room.becomeVoter' : 'room.becomeObserver')}
              </Button>
            )}
            <div className="flex items-center gap-2">
              <Button variant="secondary" className="flex-1 justify-start" onClick={() => setTheme(dark ? 'light' : 'dark')}>{dark ? <Sun /> : <Moon />}{dark ? t('app.themeLight') : t('app.themeDark')}</Button>
              <LanguageSelect />
            </div>
          </div>
          {isHost && (
            <section aria-labelledby="settings-host" className="flex flex-col gap-3.5 border-t border-border pt-4">
              <h3 id="settings-host" className="text-sm font-[650]">{t('settings.hostTitle')}</h3>
              <div className="flex flex-col gap-2">
                <span id="settings-timer" className="text-[13px] font-semibold">{t('createRoom.timer')}</span>
                <TimerChips labelledBy="settings-timer" value={state.revealRule.timerSec} onChange={timerSec => run({ type: 'setRevealRule', timerSec })} />
                <span className="text-[13px] text-muted-foreground">{t('settings.nextRound')}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="settings-auto">{t('createRoom.autoReveal')}</Label>
                <Switch id="settings-auto" checked={state.revealRule.onAllVoted} onCheckedChange={onAllVoted => run({ type: 'setRevealRule', onAllVoted })} />
              </div>
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="settings-lock">{t('settings.lock')}</Label>
                <Switch id="settings-lock" checked={state.access.locked} onCheckedChange={locked => run({ type: 'setAccess', locked })} />
              </div>
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="settings-approval">{t('createRoom.requireApproval')}</Label>
                <Switch id="settings-approval" checked={state.access.requireApproval} onCheckedChange={requireApproval => run({ type: 'setAccess', requireApproval })} />
              </div>
              {owner && <PasswordSection slug={slug} hasPassword={hasPassword} />}
              <Button variant="outline" onClick={() => setNewSession(true)}>{t('settings.newSession')}</Button>
            </section>
          )}
        </SheetContent>
      </Sheet>
      {me && profile && <ProfileDialog open={profile} onOpenChange={setProfile} me={me} send={send} />}
      <ConfirmDialog
        open={newSession}
        title={t('settings.newSessionTitle')}
        body={t('settings.newSessionBody')}
        confirmLabel={t('settings.newSessionConfirm')}
        onCancel={() => setNewSession(false)}
        onConfirm={() => { run({ type: 'startSession' }); setNewSession(false) }}
      />
    </>
  )
}
