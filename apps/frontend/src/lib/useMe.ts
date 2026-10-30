import { create } from 'zustand'
import { useEffect } from 'react'
import { api, ApiError } from './api'

export interface User { id: string; email: string; displayName: string; avatar: string | null }

interface AuthState {
  user: User | null
  loading: boolean
  loaded: boolean
  setUser: (user: User | null) => void
  load: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  loading: true,
  loaded: false,
  setUser: user => set({ user, loading: false, loaded: true }),
  load: async () => {
    if (get().loaded) return
    set({ loading: true })
    try {
      const { user } = await api.get<{ user: User }>('/me')
      set({ user, loading: false, loaded: true })
    } catch (e) {
      if (!(e instanceof ApiError) || e.status !== 401) console.error(e)
      set({ user: null, loading: false, loaded: true })
    }
  },
}))

export function useMe(): { user: User | null; loading: boolean } {
  const user = useAuthStore(s => s.user)
  const loading = useAuthStore(s => s.loading)
  const load = useAuthStore(s => s.load)
  useEffect(() => { void load() }, [load])
  return { user, loading }
}

export async function logout(): Promise<void> {
  await api.post('/auth/logout')
  useAuthStore.getState().setUser(null)
}
