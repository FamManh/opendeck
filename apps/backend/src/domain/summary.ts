import { SPECIAL_IDS, isSpecialId, type SpecialId } from './deck'
import type { RoomState } from './room/types'

export interface SummaryRow { key: string | null; title: string; final: string; rounds: number; notes: string; specialCards: SpecialId[] }
export interface Summary { rows: SummaryRow[]; totals: { items: number; finalized: number; rounds: number; mostUsedSpecial: SpecialId | null } }

export function buildSummary(s: RoomState): Summary {
  const revealed = s.current?.status === 'revealed' ? [...s.history, s.current] : s.history
  const rows = s.items.map((item): SummaryRow => {
    const rounds = revealed.filter(r => r.itemId === item.id)
    const outcome = s.outcomes.find(o => o.itemId === item.id)
    const used = new Set(rounds.flatMap(r => Object.values(r.votes)))
    // §7: notes are reason texts only, never who wrote them.
    const notes = [
      outcome?.note ?? '',
      ...rounds.flatMap(r => Object.values(r.reasons)),
      ...s.notes.filter(n => n.itemId === item.id).map(n => n.text),
      ...s.questions.filter(q => q.itemId === item.id).map(q => q.text),
    ].filter(Boolean)
    return {
      key: item.externalRef,
      title: item.title,
      final: outcome?.value ?? '',
      rounds: rounds.length,
      notes: notes.join('\n'),
      specialCards: SPECIAL_IDS.filter(id => used.has(id)),
    }
  })

  const counts = new Map<SpecialId, number>()
  for (const r of revealed) for (const c of Object.values(r.votes)) if (isSpecialId(c)) counts.set(c, (counts.get(c) ?? 0) + 1)
  let mostUsedSpecial: SpecialId | null = null
  let best = 0
  for (const id of SPECIAL_IDS) {
    const n = counts.get(id) ?? 0
    if (n > best) { best = n; mostUsedSpecial = id }
  }

  return { rows, totals: { items: s.items.length, finalized: s.outcomes.length, rounds: revealed.length, mostUsedSpecial } }
}

const HEADER = ['key', 'title', 'final', 'rounds', 'notes', 'special_cards']
const FORMULA_START = /^[=+\-@\t\r]/

function cell(v: string | number): string {
  if (typeof v === 'number') return String(v)
  const safe = FORMULA_START.test(v) ? `'${v}` : v
  return /[",\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe
}

export function toCsv(rows: SummaryRow[]): string {
  const lines = [
    HEADER.join(','),
    ...rows.map(r => [r.key ?? '', r.title, r.final, r.rounds, r.notes, r.specialCards.join(';')].map(cell).join(',')),
  ]
  return '\uFEFF' + lines.map(l => `${l}\r\n`).join('')
}
