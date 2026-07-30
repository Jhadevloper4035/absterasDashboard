import { useAuthStore } from '@/store/authStore'
import { buildApiUrl } from './apiUrl'

type ApiFetchOptions = RequestInit & {
  token?: string
  skipRefresh?: boolean
}

export async function apiFetch<T>(path: string, { token, headers, skipRefresh, ...options }: ApiFetchOptions = {}) {
  const requestHeaders = new Headers(headers)
  const authToken = token || useAuthStore.getState().token

  if (authToken) requestHeaders.set('Authorization', `Bearer ${authToken}`)
  if (options.body && !(typeof FormData !== 'undefined' && options.body instanceof FormData) && !requestHeaders.has('Content-Type')) {
    requestHeaders.set('Content-Type', 'application/json')
  }

  const response = await fetch(buildApiUrl(path), {
    ...options,
    credentials: 'include',
    headers: requestHeaders,
  })
  const body = await response.json().catch(() => ({}))

  if (!response.ok) {
    if (response.status === 401 && !skipRefresh) {
      const session = await useAuthStore.getState().refresh()
      return apiFetch<T>(path, { token: session.token, headers, skipRefresh: true, ...options })
    }

    throw new Error(body.error?.message || body.message || body.error || 'Request failed')
  }

  return body as T
}

export const apiRequest = <T>(path: string, options: RequestInit = {}, token?: string) => apiFetch<T>(path, { ...options, token })
