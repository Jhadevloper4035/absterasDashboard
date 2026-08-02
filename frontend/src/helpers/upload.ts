import { buildApiUrl } from './apiUrl'

export function uploadMultipartFiles<T>(files: File[], token: string, onProgress?: (progress: number) => void) {
  return new Promise<T[]>((resolve, reject) => {
    const body = new FormData()
    files.forEach((file) => body.append('files', file))

    const request = new XMLHttpRequest()
    request.open('POST', buildApiUrl('/uploads/multipart'))
    request.withCredentials = true
    request.setRequestHeader('Authorization', `Bearer ${token}`)
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100))
    }
    request.onload = () => {
      try {
        const body = JSON.parse(request.responseText || '{}')
        if (request.status >= 200 && request.status < 300) {
          onProgress?.(100)
          resolve(body.data || [])
        } else {
          reject(new Error(body.error?.message || body.message || body.error || 'Upload failed'))
        }
      } catch {
        reject(new Error('Upload failed'))
      }
    }
    request.onerror = () => reject(new Error('Upload failed'))
    request.send(body)
  })
}
