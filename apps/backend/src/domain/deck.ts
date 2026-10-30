import { DomainError } from './errors'

export type SpecialId = 'coffee'|'question'|'bug'|'bomb'|'puzzle'|'infinity'|'shrug'

export interface Card { id: string; label: string; numeric: number|null; special: boolean }
export interface Scale { id: string; name: string; kind: 'numeric'|'ordinal'; cards: Card[] }

export const SPECIAL_IDS: readonly SpecialId[] = ['coffee','question','bug','bomb','puzzle','infinity','shrug']

// Labels are language-neutral; the UI translates special cards via i18n key `cards.special.<id>`.
export const SPECIAL_CARDS: Card[] = SPECIAL_IDS.map(id => ({ id, label: id, numeric: null, special: true }))

export function isSpecialId(id: string): id is SpecialId {
  return (SPECIAL_IDS as readonly string[]).includes(id)
}

const NUMERIC_RE = /^\d+(\.\d+)?$/

function card(label: string, numeric: boolean): Card {
  return { id: label, label, numeric: numeric ? Number(label) : null, special: false }
}

function scale(id: string, name: string, labels: string[]): Scale {
  const numeric = labels.every(l => NUMERIC_RE.test(l))
  return { id, name, kind: numeric ? 'numeric' : 'ordinal', cards: labels.map(l => card(l, numeric)) }
}

// Preset names are fallbacks; the UI translates presets via i18n key `scales.<id>`.
export const PRESET_SCALES = {
  fibonacci: scale('fibonacci', 'Fibonacci', ['1','2','3','5','8','13','21']),
  tshirt: scale('tshirt', 'T-shirt', ['XS','S','M','L','XL']),
  hours: scale('hours', 'Hours', ['0.5','1','2','4','8','16','24']),
  days: scale('days', 'Days', ['0.5','1','2','3','5','8']),
} satisfies Record<'fibonacci'|'tshirt'|'hours'|'days', Scale>

/** Scale cards followed by the enabled special cards, always in canonical SPECIAL_IDS order. */
export function deckOf(s: Scale, enabledSpecials: readonly SpecialId[] = SPECIAL_IDS): Card[] {
  for (const id of enabledSpecials) if (!isSpecialId(id)) throw new DomainError('UNKNOWN_SPECIAL')
  const enabled = new Set<string>(enabledSpecials)
  return [...s.cards, ...SPECIAL_CARDS.filter(c => enabled.has(c.id))]
}

export function createCustomScale(name: string, labels: string[]): Scale {
  const trimmed = labels.map(l => l.trim())
  if (trimmed.length < 2) throw new DomainError('SCALE_TOO_SMALL')
  if (trimmed.some(l => l === '')) throw new DomainError('SCALE_EMPTY_LABEL')
  if (trimmed.some(isSpecialId)) throw new DomainError('SCALE_RESERVED_LABEL')
  if (new Set(trimmed).size !== trimmed.length) throw new DomainError('SCALE_DUPLICATE')
  return scale('custom', name.trim(), trimmed)
}
