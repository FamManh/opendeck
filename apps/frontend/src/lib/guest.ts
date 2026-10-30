import { isSpecies, type Species } from '@/components/game/Mascot'

const KEY = 'opendeck.guest'

export interface GuestProfile { name: string; avatar: Species }

export function loadGuest(): GuestProfile | null {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null') as { name?: unknown; avatar?: unknown } | null
    if (v && typeof v.name === 'string' && v.name.trim() && isSpecies(v.avatar)) return { name: v.name, avatar: v.avatar }
  } catch { /* corrupt value: treat as no profile */ }
  return null
}

export function saveGuest(p: GuestProfile): void {
  localStorage.setItem(KEY, JSON.stringify(p))
}
