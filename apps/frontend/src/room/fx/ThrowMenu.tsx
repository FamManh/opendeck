import { useRef, useState, type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { Popover } from 'radix-ui'
import { NotoEmoji } from '@/components/game/NotoEmoji'
import { loadPhysics } from '@/fx/physics'
import { getFxSettings } from '@/fx/prefs'
import { ITEM_EMOJI, ITEM_KINDS, ITEM_MAX, ITEM_WINDOW_MS, type ItemKind } from '@/fx/throws'
import { useRoomStore } from '@/store/roomStore'

/** Only these have an animated Noto version; the rest stay still on hover. */
const ANIMATED: ReadonlySet<ItemKind> = new Set(['tomato', 'poop', 'bomb', 'heart'])

/** Client-side mirror of the server limit so spamming greys the buttons instead of failing silently. */
export function useThrowItem() {
  const sendFx = useRoomStore(s => s.sendFx)
  const hits = useRef<number[]>([])
  const [blocked, setBlocked] = useState(false)
  const throwItem = (target: string, kind: ItemKind) => {
    const now = Date.now()
    hits.current = hits.current.filter(h => h > now - ITEM_WINDOW_MS)
    if (hits.current.length >= ITEM_MAX) return
    hits.current.push(now)
    if (hits.current.length >= ITEM_MAX) {
      setBlocked(true)
      setTimeout(() => setBlocked(false), Math.max(0, hits.current[0]! + ITEM_WINDOW_MS - now))
    }
    void sendFx('fx:throw', { target, kind }).catch(() => {})
  }
  return { throwItem, blocked }
}

function ItemButton({ kind, label, disabled, onClick }: { kind: ItemKind; label: string; disabled: boolean; onClick: () => void }) {
  const [live, setLive] = useState(false)
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      onPointerEnter={() => setLive(true)}
      onPointerLeave={() => setLive(false)}
      onFocus={() => setLive(true)}
      onBlur={() => setLive(false)}
      className="flex size-11 items-center justify-center rounded-full bg-muted transition-transform hover:scale-110 active:scale-90 disabled:opacity-40"
    >
      <NotoEmoji emoji={ITEM_EMOJI[kind]} animated={live && ANIMATED.has(kind)} className="size-7" />
    </button>
  )
}

/** Wraps a seat's avatar: tapping it opens a small tray of things to throw at that person. */
export function ThrowMenu({ name, blocked, onPick, children }: {
  name: string; blocked: boolean; onPick: (kind: ItemKind) => void; children: ReactElement
}) {
  const { t } = useTranslation()
  return (
    // Warm up matter-js while the user is choosing, so their own throw already has physics.
    <Popover.Root onOpenChange={open => { if (open && getFxSettings().level === 'full') void loadPhysics().catch(() => {}) }}>
      <Popover.Trigger asChild>{children}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="top"
          sideOffset={8}
          collisionPadding={12}
          data-slot="throw-menu"
          aria-label={t('fx.throwAt', { name })}
          className="z-50 flex gap-1.5 rounded-full bg-popover p-1.5 text-popover-foreground shadow-xl ring-1 ring-foreground/10 outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
        >
          {ITEM_KINDS.map(k => (
            <ItemButton key={k} kind={k} label={t(`fx.throwItem.${k}`, { name })} disabled={blocked} onClick={() => onPick(k)} />
          ))}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
