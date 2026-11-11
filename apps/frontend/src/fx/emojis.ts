import { NOTO_EMOJI } from './noto-emoji'

/**
 * Reactions use Noto Animated Emoji (https://googlefonts.github.io/noto-emoji-animation/).
 * The backend accepts the same list (`apps/backend/src/realtime/reaction-emojis.ts`).
 */
export const QUICK_EMOJIS = ['👏', '😂', '🤔', '😮'] as const

/** Order matches the category index stored in NOTO_EMOJI. */
export const NOTO_CATEGORIES = ['smileys', 'people', 'nature', 'food', 'travel', 'activities', 'objects', 'symbols', 'flags'] as const
export type EmojiCategory = (typeof NOTO_CATEGORIES)[number]

export interface EmojiEntry { emoji: string; tags: string; category: EmojiCategory }

export const EMOJIS: readonly EmojiEntry[] = NOTO_EMOJI.map(([emoji, tags, c]) => ({ emoji, tags, category: NOTO_CATEGORIES[c]! }))

export const EMOJIS_BY_CATEGORY: ReadonlyMap<EmojiCategory, readonly EmojiEntry[]> = new Map(
  NOTO_CATEGORIES.map(c => [c, EMOJIS.filter(e => e.category === c)]),
)

const BY_EMOJI = new Map(EMOJIS.map(e => [e.emoji, e]))
/** First shortcode, e.g. `:joy:`. */
export const shortcodeOf = (emoji: string) => BY_EMOJI.get(emoji)?.tags.split(' ')[0] ?? ''

/** Matches shortcodes by substring; `:joy:`, `joy` and `jo` all find 😂. */
export function searchEmojis(query: string): EmojiEntry[] {
  const q = query.trim().toLowerCase().replace(/^:+|:+$/g, '')
  if (!q) return []
  return EMOJIS.filter(e => e.tags.includes(q))
}

const RECENT_KEY = 'opendeck.recentEmojis'
const RECENT_MAX = 24

export function loadRecent(): string[] {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]')
    return Array.isArray(v) ? v.filter((e): e is string => typeof e === 'string' && BY_EMOJI.has(e)).slice(0, RECENT_MAX) : []
  } catch {
    return []
  }
}

export function pushRecent(emoji: string): string[] {
  const next = [emoji, ...loadRecent().filter(e => e !== emoji)].slice(0, RECENT_MAX)
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)) } catch { /* private mode: keep it in memory only */ }
  return next
}

/** Noto asset id: code points in lowercase hex joined by `_` (variation selectors included). */
export const notoCode = (emoji: string) => [...emoji].map(c => c.codePointAt(0)!.toString(16)).join('_')

const NOTO_BASE = 'https://fonts.gstatic.com/s/e/notoemoji/latest'
/** Animated WebP (512px) and a static SVG of the same artwork. */
export const notoAnimated = (emoji: string) => `${NOTO_BASE}/${notoCode(emoji)}/512.webp`
export const notoStatic = (emoji: string) => `${NOTO_BASE}/${notoCode(emoji)}/emoji.svg`
