import { useCallback, useEffect, useState } from 'react'

export type FxLevel = 'full' | 'medium' | 'minimal'
export interface FxPrefs { level: FxLevel; sound: boolean; followReducedMotion: boolean }

export const FX_STORAGE_KEY = 'pp.fx'
export const DEFAULT_FX_PREFS: FxPrefs = { level: 'full', sound: true, followReducedMotion: true }

const RANK: Record<FxLevel, number> = { minimal: 0, medium: 1, full: 2 }
const LEVELS: FxLevel[] = ['full', 'medium', 'minimal']

export function lowerLevel(a: FxLevel, b: FxLevel): FxLevel {
  return RANK[a] <= RANK[b] ? a : b
}

export function resolveLevel(p: FxPrefs, reducedMotion: boolean, governorCap: FxLevel | null): FxLevel {
  let level = p.level
  if (reducedMotion && p.followReducedMotion) level = 'minimal'
  if (governorCap) level = lowerLevel(level, governorCap)
  return level
}

export function soundEnabled(p: FxPrefs, effective: FxLevel): boolean {
  return effective === 'full' && p.sound
}

export function loadPrefs(): FxPrefs {
  try {
    const raw = localStorage.getItem(FX_STORAGE_KEY)
    if (!raw) return { ...DEFAULT_FX_PREFS }
    const v = JSON.parse(raw) as Partial<FxPrefs>
    return {
      level: LEVELS.includes(v.level as FxLevel) ? (v.level as FxLevel) : DEFAULT_FX_PREFS.level,
      sound: typeof v.sound === 'boolean' ? v.sound : DEFAULT_FX_PREFS.sound,
      followReducedMotion:
        typeof v.followReducedMotion === 'boolean' ? v.followReducedMotion : DEFAULT_FX_PREFS.followReducedMotion,
    }
  } catch {
    return { ...DEFAULT_FX_PREFS }
  }
}

function savePrefs(p: FxPrefs) {
  try { localStorage.setItem(FX_STORAGE_KEY, JSON.stringify(p)) } catch { /* private mode */ }
}

const REDUCED_QUERY = '(prefers-reduced-motion: reduce)'

// Governor cap lasts for the session only and never rises (see FpsGovernor).
let sessionCap: FxLevel | null = null
const capListeners = new Set<() => void>()
export function setGovernorCap(cap: FxLevel) {
  sessionCap = sessionCap ? lowerLevel(sessionCap, cap) : cap
  capListeners.forEach(l => l())
}
export function getGovernorCap() { return sessionCap }
export function resetGovernorCap() { sessionCap = null; capListeners.forEach(l => l()) }

/** Non-hook equivalent of useFxPrefs().effective, for code outside React (the fx runtime). */
export function getFxSettings(): { prefs: FxPrefs; level: FxLevel } {
  const prefs = loadPrefs()
  const reduced = window.matchMedia?.(REDUCED_QUERY).matches ?? false
  return { prefs, level: resolveLevel(prefs, reduced, sessionCap) }
}

export function useFxPrefs() {
  const [prefs, setPrefs] = useState<FxPrefs>(loadPrefs)
  const [reduced, setReduced] = useState(() => window.matchMedia?.(REDUCED_QUERY).matches ?? false)
  const [cap, setCap] = useState<FxLevel | null>(sessionCap)

  useEffect(() => {
    const mq = window.matchMedia?.(REDUCED_QUERY)
    if (!mq) return
    const on = () => setReduced(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])

  useEffect(() => {
    const on = () => setCap(sessionCap)
    capListeners.add(on)
    return () => { capListeners.delete(on) }
  }, [])

  const set = useCallback((patch: Partial<FxPrefs>) => {
    setPrefs(prev => {
      const next = { ...prev, ...patch }
      savePrefs(next)
      return next
    })
  }, [])

  return { prefs, effective: resolveLevel(prefs, reduced, cap), set }
}
