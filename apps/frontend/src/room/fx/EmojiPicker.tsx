import { useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Popover } from 'radix-ui'
import { Building2, Clock, Coffee, Flag, Leaf, Lightbulb, PersonStanding, Search, Shapes, Smile, SmilePlus, Trophy, type LucideIcon } from 'lucide-react'
import { NotoEmoji } from '@/components/game/NotoEmoji'
import { EMOJIS_BY_CATEGORY, loadRecent, NOTO_CATEGORIES, pushRecent, searchEmojis, shortcodeOf, type EmojiCategory } from '@/fx/emojis'

type Section = 'recent' | EmojiCategory

const ICONS: Record<Section, LucideIcon> = {
  recent: Clock, smileys: Smile, people: PersonStanding, nature: Leaf, food: Coffee,
  travel: Building2, activities: Trophy, objects: Lightbulb, symbols: Shapes, flags: Flag,
}
const SECTIONS: readonly Section[] = ['recent', ...NOTO_CATEGORIES]

/** Still artwork that plays its animation while hovered or focused. */
export function EmojiButton({ emoji, label, title, disabled, onClick, className, size }: {
  emoji: string; label: string; title?: string; disabled: boolean; onClick: () => void; className: string; size: string
}) {
  const [live, setLive] = useState(false)
  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={label}
      title={title}
      onClick={onClick}
      onPointerEnter={() => setLive(true)}
      onPointerLeave={() => setLive(false)}
      onFocus={() => setLive(true)}
      onBlur={() => setLive(false)}
      className={`flex items-center justify-center ${className}`}
    ><NotoEmoji emoji={emoji} animated={live} lazy className={size} /></button>
  )
}

export interface EmojiPickerProps {
  vertical: boolean
  blocked: boolean
  onPick: (emoji: string) => void
  triggerClass: string
}

/** Meet-style picker: search, category jump bar, recently used, then every Noto animated emoji. */
export function EmojiPicker({ vertical, blocked, onPick, triggerClass }: EmojiPickerProps) {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [recent, setRecent] = useState<string[]>([])
  const [active, setActive] = useState<Section>('recent')
  const scroller = useRef<HTMLDivElement>(null)
  const heads = useRef(new Map<Section, HTMLElement>())

  const pick = (emoji: string) => {
    onPick(emoji)
    setRecent(pushRecent(emoji))
  }
  const jump = (s: Section) => {
    setQuery('')
    setActive(s)
    // Wait a frame when leaving search so the sections are back in the DOM.
    requestAnimationFrame(() => {
      const el = heads.current.get(s)
      if (el && scroller.current) scroller.current.scrollTo({ top: el.offsetTop - 4 })
    })
  }
  const onScroll = () => {
    const box = scroller.current
    if (!box) return
    // Headings' offsetTop is relative to the scroller (it is the positioned ancestor).
    const y = box.scrollTop + 8
    let cur: Section = 'recent'
    for (const s of SECTIONS) {
      const el = heads.current.get(s)
      if (el && el.offsetTop <= y) cur = s
    }
    if (cur !== active) setActive(cur)
  }

  const grid = (list: readonly string[]) => (
    <div className="grid grid-cols-9 gap-0.5">
      {list.map(e => (
        <EmojiButton
          key={e}
          emoji={e}
          label={t('fx.react', { emoji: e })}
          title={shortcodeOf(e)}
          disabled={blocked}
          onClick={() => pick(e)}
          className="aspect-square w-full rounded-lg transition-colors hover:bg-muted active:scale-95 disabled:opacity-40"
          size="size-7 text-xl"
        />
      ))}
    </div>
  )
  const heading = (s: Section, children: ReactNode) => (
    <section key={s} className="flex flex-col gap-1.5 pb-3">
      <h3
        ref={el => { if (el) heads.current.set(s, el); else heads.current.delete(s) }}
        className="px-0.5 pt-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase"
      >{t(`fx.emojiSection.${s}`)}</h3>
      {children}
    </section>
  )
  const results = query.trim() ? searchEmojis(query) : null

  return (
    <Popover.Root onOpenChange={open => { if (open) { setRecent(loadRecent()); setQuery(''); setActive('recent') } }}>
      <Popover.Trigger asChild>
        <button type="button" aria-label={t('fx.moreReactions')} title={t('fx.moreReactions')} className={`${triggerClass} flex items-center justify-center text-muted-foreground hover:text-foreground data-[state=open]:bg-primary data-[state=open]:text-primary-foreground`}>
          <SmilePlus className="size-5" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side={vertical ? 'right' : 'top'}
          align={vertical ? 'center' : 'end'}
          sideOffset={10}
          collisionPadding={12}
          data-slot="emoji-picker"
          onOpenAutoFocus={e => { e.preventDefault(); (e.currentTarget as HTMLElement).querySelector('input')?.focus() }}
          className="z-50 flex w-[min(360px,calc(100vw-24px))] flex-col overflow-hidden rounded-2xl bg-popover text-popover-foreground shadow-xl ring-1 ring-foreground/10 outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
        >
          <div className="p-2 pb-0">
            <label className="flex h-9 items-center gap-2 rounded-lg border border-border bg-background px-2.5 focus-within:border-ring">
              <Search className="size-4 flex-none text-muted-foreground" />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder={t('fx.searchEmoji')}
                aria-label={t('fx.searchEmoji')}
                className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </label>
          </div>
          <div role="tablist" aria-label={t('fx.moreReactions')} className="flex justify-between border-b border-border px-1.5 pt-1">
            {SECTIONS.map(s => {
              const Icon = ICONS[s]
              const on = !results && active === s
              return (
                <button
                  key={s}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  aria-label={t(`fx.emojiSection.${s}`)}
                  title={t(`fx.emojiSection.${s}`)}
                  onClick={() => jump(s)}
                  className={`relative flex h-9 flex-1 items-center justify-center transition-colors ${on ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  <Icon className="size-[18px]" />
                  {on && <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-primary" />}
                </button>
              )
            })}
          </div>
          <div ref={scroller} onScroll={onScroll} className="relative h-[300px] overflow-y-auto px-2 pt-1">
            {results ? (
              results.length ? <div className="pb-3 pt-1">{grid(results.map(r => r.emoji))}</div>
                : <p className="px-0.5 py-3 text-sm text-muted-foreground">{t('fx.noEmoji')}</p>
            ) : (
              <>
                {heading('recent', recent.length ? grid(recent) : <p className="px-0.5 pb-1 text-sm text-muted-foreground">{t('fx.noRecentEmoji')}</p>)}
                {NOTO_CATEGORIES.map(c => heading(c, grid((EMOJIS_BY_CATEGORY.get(c) ?? []).map(e => e.emoji))))}
              </>
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
