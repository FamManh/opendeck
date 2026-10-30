import type { NewItem } from '@/domain'

export const MAX_IMPORT_ITEMS = 500
const KEY_PREFIX = /^([A-Za-z][A-Za-z0-9]*-\d+)(?:\s+(.*))?$/

function toItem(title: string, description: string, key = ''): NewItem {
  const item: NewItem = { title, description }
  if (key) item.externalRef = key
  return item
}

export function parseItemLines(text: string): NewItem[] {
  const items: NewItem[] = []
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line) continue
    const bar = line.indexOf('|')
    const head = (bar < 0 ? line : line.slice(0, bar)).trim()
    const description = bar < 0 ? '' : line.slice(bar + 1).trim()
    if (!head) continue
    const m = KEY_PREFIX.exec(head)
    items.push(m ? toItem(m[2]?.trim() || m[1]!, description, m[1]) : toItem(head, description))
  }
  return items
}

function parseCsvRecords(text: string): string[][] {
  const records: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  const endRow = () => { row.push(cell); cell = ''; records.push(row); row = [] }
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!
    if (quoted) {
      if (c !== '"') cell += c
      else if (text[i + 1] === '"') { cell += '"'; i++ }
      else quoted = false
    } else if (c === '"') quoted = true
    else if (c === ',') { row.push(cell); cell = '' }
    else if (c === '\n') endRow()
    else if (c !== '\r') cell += c
  }
  if (cell !== '' || row.length) endRow()
  return records.filter(r => r.some(c => c.trim() !== ''))
}

export function parseItemsCsv(text: string): NewItem[] {
  const [header, ...rows] = parseCsvRecords(text.replace(/^\uFEFF/, ''))
  const cols = (header ?? []).map(h => h.trim().toLowerCase())
  const iTitle = cols.indexOf('title')
  if (iTitle < 0) throw new Error('CSV_NO_TITLE')
  if (rows.length > MAX_IMPORT_ITEMS) throw new Error('TOO_MANY_ITEMS')
  const iDesc = cols.indexOf('description')
  const iKey = cols.indexOf('key')
  return rows.flatMap(r => {
    const title = (r[iTitle] ?? '').trim()
    if (!title) return []
    return [toItem(title, iDesc < 0 ? '' : (r[iDesc] ?? '').trim(), iKey < 0 ? '' : (r[iKey] ?? '').trim())]
  })
}
