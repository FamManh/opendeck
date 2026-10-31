import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { expect, test } from 'vitest'

const SRC = path.resolve(__dirname, '..')
const ALLOWED = new Set(['transform', 'translate', 'rotate', 'scale', 'opacity'])

function walk(dir: string, exts: string[]): string[] {
  return readdirSync(dir).flatMap(name => {
    const p = path.join(dir, name)
    if (statSync(p).isDirectory()) return walk(p, exts)
    return exts.some(e => p.endsWith(e)) ? [p] : []
  })
}

function lineOf(text: string, index: number) {
  return text.slice(0, index).split('\n').length
}

test('@keyframes only animate transform/opacity', () => {
  const problems: string[] = []
  for (const file of walk(SRC, ['.css'])) {
    const text = readFileSync(file, 'utf8')
    for (const m of text.matchAll(/@keyframes\s+[\w-]+\s*\{/g)) {
      let depth = 1
      let i = (m.index ?? 0) + m[0].length
      const start = i
      while (i < text.length && depth > 0) {
        if (text[i] === '{') depth++
        if (text[i] === '}') depth--
        i++
      }
      const body = text.slice(start, i - 1)
      // Only inspect declarations inside the innermost { } blocks.
      for (const block of body.matchAll(/\{([^{}]*)\}/g)) {
        for (const decl of block[1]!.matchAll(/([\w-]+)\s*:[^;]+/g)) {
          const prop = decl[1]!
          if (!ALLOWED.has(prop) && !prop.startsWith('--')) {
            problems.push(`${path.relative(SRC, file)}:${lineOf(text, (m.index ?? 0) + 1)} animates ${prop}`)
          }
        }
      }
    }
  }
  expect(problems).toEqual([])
})

test('effect components do not use layout/paint transitions', () => {
  const banned = /transition-all|transition-shadow|transition-\[(?:width|height|top|left|box-shadow|filter)/
  const problems: string[] = []
  for (const dir of ['room/fx', 'fx', 'components/game']) {
    const root = path.join(SRC, dir)
    try { statSync(root) } catch { continue }
    for (const file of walk(root, ['.tsx'])) {
      if (file.endsWith('.test.tsx')) continue
      readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
        if (banned.test(line)) problems.push(`${path.relative(SRC, file)}:${i + 1}`)
      })
    }
  }
  expect(problems).toEqual([])
})
