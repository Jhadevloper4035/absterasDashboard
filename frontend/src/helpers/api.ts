export const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || 'http://localhost:4000/api').replace(/\/+$/, '')

export const buildApiUrl = (path: string) => {
  const apiPath = path.startsWith('/') ? path : `/${path}`
  if (apiBaseUrl.endsWith('/api') && apiPath.startsWith('/api/')) return `${apiBaseUrl}${apiPath.slice(4)}`
  return `${apiBaseUrl}${apiPath}`
}

type ApiFetchOptions = RequestInit & {
  token?: string
}

export async function apiFetch<T>(path: string, { token, headers, ...options }: ApiFetchOptions = {}) {
  const requestHeaders = new Headers(headers)

  if (token) requestHeaders.set('Authorization', `Bearer ${token}`)
  if (options.body && !(typeof FormData !== 'undefined' && options.body instanceof FormData) && !requestHeaders.has('Content-Type')) {
    requestHeaders.set('Content-Type', 'application/json')
  }

  const response = await fetch(buildApiUrl(path), {
    ...options,
    headers: requestHeaders,
  })
  const body = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(body.error?.message || body.message || body.error || 'Request failed')
  }

  return body as T
}

export const apiRequest = <T>(path: string, options: RequestInit = {}, token?: string) => apiFetch<T>(path, { ...options, token })
