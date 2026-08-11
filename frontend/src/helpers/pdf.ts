import { buildApiUrl } from './apiUrl'

const pending = new Map<string, Promise<Blob>>()

async function pdfUrl(path: string, token?: string) {
  const key = `${path}:${token || ''}`
  let request = pending.get(key)
  if (!request) {
    request = fetch(buildApiUrl(path), { credentials: 'include', headers: token ? { Authorization: `Bearer ${token}` } : {} }).then(async (response) => {
      if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.error?.message || 'Unable to create PDF') }
      return response.blob()
    })
    pending.set(key, request)
    request.finally(() => pending.delete(key)).catch(() => {})
  }
  return URL.createObjectURL(await request)
}

export async function downloadPdf(path: string, filename: string, token?: string) {
  const url = await pdfUrl(path, token); const link = document.createElement('a'); link.href = url; link.download = filename; link.click(); URL.revokeObjectURL(url)
}

export async function printPdf(path: string, token?: string) {
  const popup = window.open('', '_blank')
  try {
    const url = await pdfUrl(path, token)
    if (popup) popup.location.href = url
    else window.location.href = url
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
  } catch (error) {
    popup?.close()
    throw error
  }
}
