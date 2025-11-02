import axios from 'axios'

const api = axios.create({ baseURL: '' }) // proxied by Vite to backend

export function setToken(token?: string) {
  if (token) api.defaults.headers.common['Authorization'] = `Bearer ${token}`
  else delete api.defaults.headers.common['Authorization']
}

export async function login(email: string, password: string) {
  const res = await api.post('/api/v1/auth/login', { email, password })
  return res.data as { user: any; token: string }
}

export async function register(email: string, password: string, firstName?: string, lastName?: string) {
  const res = await api.post('/api/v1/auth/register', { email, password, firstName, lastName })
  return res.data as { user: any; token: string }
}

export async function listFiles() {
  const res = await api.get('/api/v1/files')
  return res.data.files as Array<{ fileId: string; fileName: string; fileSize: string; mimeType: string; createdAt: string; tags?: string[]; isPasswordProtected?: boolean; thumbnailKey?: string }>
}

export async function uploadFiles(files: File[], onProgress?: (file: File, percent: number) => void) {
  for (const file of files) {
    const fd = new FormData()
    fd.append('file', file)
    await api.post('/api/v1/files/upload', fd, {
      onUploadProgress: (ev) => {
        if (!onProgress || !ev.total) return
        const pct = Math.round((ev.loaded / ev.total) * 100)
        onProgress(file, pct)
      }
    })
  }
}

export function previewUrl(fileId: string) {
  return `/api/v1/files/${fileId}/preview`
}

export function downloadUrl(fileId: string) {
  return `/api/v1/files/${fileId}/download`
}

export function thumbnailUrl(fileId: string) {
  return `/api/v1/files/${fileId}/thumbnail`
}

export async function openFileWithPassword(fileId: string, password: string, action: 'preview' | 'download') {
  const endpoint = action === 'preview' ? previewUrl(fileId) : downloadUrl(fileId)
  const res = await fetch(endpoint, { headers: { 'x-file-password': password } })
  if (!res.ok) throw new Error('Invalid password or error')
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  window.open(url, '_blank')
}

export async function setTags(fileId: string, tags: string[]) {
  await api.put(`/api/v1/files/${fileId}/tags`, { tags })
}

export async function createShare(fileId: string, opts: { password?: string; expiresAt?: string; maxDownloads?: number } = {}) {
  const res = await api.post('/api/v1/shares', { fileId, ...opts })
  return res.data as { shareId: string; expiresAt?: string; maxDownloads?: number }
}

export function publicShareDownloadUrl(shareId: string) {
  return `/api/v1/shares/${shareId}/download`
}

export async function openShareDownloadWithPassword(shareId: string, password: string) {
  const res = await fetch(publicShareDownloadUrl(shareId), { headers: { 'x-share-password': password } })
  if (!res.ok) throw new Error('Invalid password or error')
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  window.open(url, '_blank')
}
