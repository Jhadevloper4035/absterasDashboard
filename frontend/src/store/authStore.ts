import { apiFetch } from '@/helpers/api'
import type { AuthSessionType, UserType } from '@/types/auth'
import { create } from 'zustand'
import { createJSONStorage, devtools, persist } from 'zustand/middleware'

type SetupSuperadminPayload = {
  name: string
  email: string
  password: string
}

type AuthStore = {
  user: UserType | undefined
  token: string | undefined
  loading: boolean
  error: string | undefined
  setSession: (session: AuthSessionType) => void
  login: (email: string, password: string) => Promise<AuthSessionType>
  setupSuperadmin: (payload: SetupSuperadminPayload) => Promise<AuthSessionType>
  logout: () => void
}

const emptyAuth = {
  user: undefined,
  token: undefined,
  loading: false,
  error: undefined,
}

export const useAuthStore = create<AuthStore>()(
  devtools(
    persist(
      (set, get) => ({
        ...emptyAuth,
        setSession: (session) => set({ user: session.user, token: session.token, error: undefined }, false, 'auth/setSession'),
        login: async (email, password) => {
          set({ loading: true, error: undefined }, false, 'auth/login:start')
          try {
            const res = await apiFetch<{ data: AuthSessionType }>('/auth/login', {
              method: 'POST',
              body: JSON.stringify({ email, password }),
            })
            get().setSession(res.data)
            set({ loading: false }, false, 'auth/login:success')
            return res.data
          } catch (e) {
            const message = e instanceof Error ? e.message : 'Login failed'
            set({ loading: false, error: message }, false, 'auth/login:error')
            throw e
          }
        },
        setupSuperadmin: async (payload) => {
          set({ loading: true, error: undefined }, false, 'auth/setup:start')
          try {
            await apiFetch('/users', {
              method: 'POST',
              body: JSON.stringify({ ...payload, role: 'superadmin' }),
            })
            return await get().login(payload.email, payload.password)
          } catch (e) {
            const message = e instanceof Error ? e.message : 'Setup failed'
            set({ loading: false, error: message }, false, 'auth/setup:error')
            throw e
          }
        },
        logout: () => set(emptyAuth, false, 'auth/logout'),
      }),
      {
        name: 'sales-crm-auth',
        storage: createJSONStorage(() => localStorage),
        partialize: (state) => ({ user: state.user, token: state.token }),
      },
    ),
    { name: 'AuthStore' },
  ),
)
