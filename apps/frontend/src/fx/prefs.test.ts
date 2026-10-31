import { afterEach, expect, test, vi } from 'vitest'
import { DEFAULT_FX_PREFS, FX_STORAGE_KEY, loadPrefs, resolveLevel, soundEnabled } from './prefs'

afterEach(() => vi.restoreAllMocks())

test('reduced motion forces minimal when followReducedMotion', () => {
  expect(resolveLevel({ ...DEFAULT_FX_PREFS }, true, null)).toBe('minimal')
  expect(resolveLevel({ ...DEFAULT_FX_PREFS, followReducedMotion: false }, true, null)).toBe('full')
})

test('governor cap only lowers', () => {
  expect(resolveLevel({ ...DEFAULT_FX_PREFS, level: 'minimal' }, false, 'medium')).toBe('minimal')
  expect(resolveLevel(DEFAULT_FX_PREFS, false, 'medium')).toBe('medium')
})

test('sound only on full', () => {
  expect(soundEnabled(DEFAULT_FX_PREFS, 'medium')).toBe(false)
  expect(soundEnabled(DEFAULT_FX_PREFS, 'full')).toBe(true)
  expect(soundEnabled({ ...DEFAULT_FX_PREFS, sound: false }, 'full')).toBe(false)
})

test('corrupt localStorage falls back to defaults', () => {
  localStorage.setItem(FX_STORAGE_KEY, '{bad')
  expect(loadPrefs()).toEqual(DEFAULT_FX_PREFS)
})

test('invalid field values fall back per field', () => {
  localStorage.setItem(FX_STORAGE_KEY, JSON.stringify({ level: 'ultra', sound: false }))
  expect(loadPrefs()).toEqual({ ...DEFAULT_FX_PREFS, sound: false })
})

test('localStorage throwing (private mode) does not crash', () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied') })
  expect(loadPrefs()).toEqual(DEFAULT_FX_PREFS)
})
