import React, { useEffect, useMemo, useState } from 'react'
import { createShare, downloadUrl, listFiles, login, openFileWithPassword, openShareDownloadWithPassword, previewUrl, register, setTags, setToken, thumbnailUrl, uploadFiles } from '../api'

type ToastType = 'info' | 'success' | 'error'

function useAuth() {
  const [tokenState, setTokenState] = useState<string | null>(() => localStorage.getItem('token'))
  useEffect(() => {
    setToken(tokenState || undefined)
  }, [tokenState])
  return {
    token: tokenState,
    setToken: (t: string | null) => {
      setTokenState(t)
      if (t) localStorage.setItem('token', t)
      else localStorage.removeItem('token')
    }
  }
}

function useToasts() {
  const [toasts, setToasts] = useState<Array<{ id: number; message: string; type: ToastType }>>([])
  const push = (message: string, type: ToastType = 'info') => {
    const id = Date.now() + Math.random()
    setToasts((t: Array<{ id: number; message: string; type: ToastType }>) => [...t, { id, message, type }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3000)
  }
  const view = (
    <div style={{ position: 'fixed', right: 16, bottom: 16, display: 'flex', flexDirection: 'column', gap: 8, zIndex: 9999 }}>
      {toasts.map((t) => (
        <div key={t.id} style={{ padding: '8px 12px', borderRadius: 6, color: '#fff', background: t.type==='error'?'#d14343':t.type==='success'?'#2d8f4e':'#2f6fed', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
          {t.message}
        </div>
      ))}
    </div>
  )
  return { push, view }
}

export function App() {
  const { token, setToken } = useAuth()
  return token ? <FilesPage onLogout={() => setToken(null)} /> : <AuthPage onAuth={(t) => setToken(t)} />
}

function AuthPage({ onAuth }: { onAuth: (t: string) => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'login'|'register'>('login')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const submit = async () => {
    setLoading(true); setError(null)
    try {
      const res = mode === 'login' ? await login(email, password) : await register(email, password)
      onAuth(res.token)
    } catch (e: unknown) {
      const err = e as any
      setError(err?.response?.data?.message || 'Auth failed')
    } finally { setLoading(false) }
  }
  return (
    <div style={{ maxWidth: 420, margin: '64px auto', fontFamily: 'Inter, system-ui, Arial' }}>
      <h2>Live-Data</h2>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button onClick={() => setMode('login')} disabled={mode==='login'}>Login</button>
        <button onClick={() => setMode('register')} disabled={mode==='register'}>Register</button>
      </div>
      <input placeholder="Email" value={email} onChange={(e: React.ChangeEvent<HTMLInputElement>)=>setEmail(e.target.value)} style={{ width: '100%', padding: 8, marginBottom: 8 }} />
      <input placeholder="Password" type="password" value={password} onChange={(e: React.ChangeEvent<HTMLInputElement>)=>setPassword(e.target.value)} style={{ width: '100%', padding: 8, marginBottom: 8 }} />
      <button onClick={submit} disabled={loading} style={{ width: '100%', padding: 10 }}>{loading? 'Please wait...' : (mode==='login'?'Login':'Register')}</button>
      {error && <div style={{ color: 'crimson', marginTop: 8 }}>{error}</div>}
    </div>
  )
}

function humanSize(bytes: string | number) {
  const n = typeof bytes === 'string' ? Number(bytes) : bytes
  if (!isFinite(n)) return ''
  const units = ['B','KB','MB','GB','TB']
  let i = 0, b = n
  while (b >= 1024 && i < units.length-1) { b /= 1024; i++ }
  return `${b.toFixed(1)} ${units[i]}`
}

function FilesPage({ onLogout }: { onLogout: () => void }) {
  const { push, view } = useToasts()
  const [files, setFiles] = useState<Array<any>>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [progressMap, setProgressMap] = useState<Record<string, number>>({})

  const refresh = async () => {
    setLoading(true); setError(null)
    try { setFiles(await listFiles()) } catch (e: unknown) { const err = e as any; setError(err?.response?.data?.message || 'Failed') } finally { setLoading(false) }
  }
  useEffect(() => { refresh() }, [])

  const onFileInput = async (ev: React.ChangeEvent<HTMLInputElement>) => {
    const files = ev.target.files ? Array.from(ev.target.files) as File[] : []
    await handleUploads(files)
    ev.target.value = ''
  }

  const handleUploads = async (incoming: File[]) => {
    if (!incoming.length) return
    push(`Uploading ${incoming.length} file(s)...`, 'info')
    setProgressMap((pm) => ({ ...pm, ...Object.fromEntries(incoming.map((f) => [f.name, 0])) }))
    try {
      await uploadFiles(incoming, (file, pct) => setProgressMap((pm) => ({ ...pm, [file.name]: pct })))
      push('Upload complete', 'success')
      await refresh()
    } catch {
      push('Upload failed', 'error')
    } finally {
      setProgressMap((pm) => {
        const copy: Record<string, number> = { ...pm }; incoming.forEach((f) => delete copy[f.name]); return copy
      })
    }
  }

  const onDrop = async (ev: React.DragEvent<HTMLDivElement>) => {
    ev.preventDefault(); ev.stopPropagation(); setDragOver(false)
    const dt = ev.dataTransfer
    const files = dt.files ? Array.from(dt.files) as File[] : []
    await handleUploads(files)
  }

  const onDragOver = (ev: React.DragEvent<HTMLDivElement>) => { ev.preventDefault(); setDragOver(true) }
  const onDragLeave = (ev: React.DragEvent<HTMLDivElement>) => { ev.preventDefault(); setDragOver(false) }

  return (
    <div style={{ maxWidth: 960, margin: '32px auto', fontFamily: 'Inter, system-ui, Arial' }}>
      {view}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Your files</h2>
        <div>
          <input type="file" multiple onChange={onFileInput} />
          <button onClick={onLogout} style={{ marginLeft: 8 }}>Logout</button>
        </div>
      </div>
      <div onDrop={onDrop} onDragOver={onDragOver} onDragLeave={onDragLeave} style={{ marginTop: 12, padding: 16, border: '2px dashed #bbb', borderColor: dragOver ? '#2f6fed' : '#bbb', borderRadius: 10, textAlign: 'center', color: '#555' }}>
        Drag & drop files here to upload
      </div>
      {Object.keys(progressMap).length > 0 && (
        <div style={{ marginTop: 12 }}>
          {Object.entries(progressMap).map(([name, pct]) => (
            <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <div style={{ width: 220, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
              <div style={{ flex: 1, background: '#eee', height: 8, borderRadius: 999 }}>
                <div style={{ width: `${pct}%`, background: '#2f6fed', height: '100%', borderRadius: 999 }} />
              </div>
              <div style={{ width: 40, textAlign: 'right' }}>{pct}%</div>
            </div>
          ))}
        </div>
      )}
      {loading && <div>Loading...</div>}
      {error && <div style={{ color: 'crimson' }}>{error}</div>}
      <table width="100%" cellPadding={6} style={{ borderCollapse: 'collapse', marginTop: 12 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1px solid #ddd' }}>
            <th>Preview</th>
            <th>Name</th>
            <th>Size</th>
            <th>Type</th>
            <th>Tags</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {files.map((f: any) => <FileRow key={f.fileId} f={f} onChanged={refresh} pushToast={push} />)}
        </tbody>
      </table>
    </div>
  )
}

function FileRow({ f, onChanged, pushToast }: { f: any; onChanged: () => void; pushToast: (m: string, t?: ToastType) => void }) {
  const [tagsStr, setTagsStr] = useState((f.tags || []).join(', '))
  const saveTags = async () => {
    const tags = tagsStr.split(',').map((t: string) => t.trim()).filter(Boolean)
    try { await setTags(f.fileId, tags); pushToast('Tags saved','success'); await onChanged() } catch { pushToast('Failed to save tags','error') }
  }
  const makeShare = async () => {
    const password = window.confirm('Protect share with a password? Click OK to enter, Cancel for none.') ? (window.prompt('Enter share password') || '') : ''
    const payload: any = {}
    if (password) payload.password = password
    const res = await createShare(f.fileId, payload)
    const url = `/api/v1/shares/${res.shareId}/download`
    pushToast(`Share created: ${url}`,'success')
  }
  const handlePreview = async () => {
    if (f.isPasswordProtected) {
      const pw = window.prompt('Enter file password for preview')
      if (!pw) return
      try { await openFileWithPassword(f.fileId, pw, 'preview') } catch { alert('Incorrect password') }
    } else {
      window.open(previewUrl(f.fileId), '_blank')
    }
  }
  const handleDownload = async () => {
    if (f.isPasswordProtected) {
      const pw = window.prompt('Enter file password to download')
      if (!pw) return
      try { await openFileWithPassword(f.fileId, pw, 'download') } catch { alert('Incorrect password') }
    } else {
      window.location.href = downloadUrl(f.fileId)
    }
  }
  const thumb = f.thumbnailKey && f.mimeType.startsWith('image/') ? thumbnailUrl(f.fileId) : ''
  return (
    <tr style={{ borderBottom: '1px solid #eee' }}>
      <td>{thumb ? <img src={thumb} alt="thumb" width={64} height={64} style={{ objectFit: 'cover', borderRadius: 4 }} /> : '-'}</td>
      <td>{f.fileName}{f.isPasswordProtected ? ' 🔒' : ''}</td>
      <td>{humanSize(f.fileSize)}</td>
      <td>{f.mimeType}</td>
      <td>
        <input value={tagsStr} onChange={(e: React.ChangeEvent<HTMLInputElement>)=>setTagsStr(e.target.value)} style={{ width: 180 }} />
        <button onClick={saveTags} style={{ marginLeft: 6 }}>Save</button>
      </td>
      <td>
        <button onClick={handlePreview}>Preview</button>
        {' '}
        <button onClick={handleDownload}>Download</button>
        {' '}
        <button onClick={makeShare}>Share</button>
      </td>
    </tr>
  )
}
