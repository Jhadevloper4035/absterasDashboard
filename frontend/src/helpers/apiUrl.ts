export const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || 'http://localhost:4000/api').replace(/\/+$/, '')

export const buildApiUrl = (path: string) => {
  const apiPath = path.startsWith('/') ? path : `/${path}`
  if (apiBaseUrl.endsWith('/api') && apiPath.startsWith('/api/')) return `${apiBaseUrl}${apiPath.slice(4)}`
  return `${apiBaseUrl}${apiPath}`
}
