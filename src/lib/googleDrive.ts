import type { ProjectBackup } from './backup'

/**
 * Scope Google Drive seminimal mungkin sesuai PRD 6.1:
 * 'https://www.googleapis.com/auth/drive.file' hanya mengakses file yang dibuat oleh aplikasi ini.
 */
export const DRIVE_FILE_SCOPE = 'https://www.googleapis.com/auth/drive.file'

export interface GoogleDriveState {
  connected: boolean
  userEmail: string | null
  tokenExpiresAt: number | null
}

/**
 * Token akses OAuth disimpan HANYA DI MEMORI sementara aplikasi,
 * tidak disimpan di Local Storage atau IndexedDB (PRD 6.1 & 16.1).
 */
let inMemoryAccessToken: string | null = null
let inMemoryExpiresAt: number | null = null
let inMemoryEmail: string | null = null

export function getStoredClientId(): string {
  return localStorage.getItem('interview_workspace_google_client_id') || import.meta.env.VITE_GOOGLE_CLIENT_ID || ''
}

export function setStoredClientId(clientId: string): void {
  const trimmed = clientId.trim()
  if (trimmed) {
    localStorage.setItem('interview_workspace_google_client_id', trimmed)
  } else {
    localStorage.removeItem('interview_workspace_google_client_id')
  }
}

export function isGoogleDriveConnected(): boolean {
  if (!inMemoryAccessToken) return false
  if (inMemoryExpiresAt && Date.now() >= inMemoryExpiresAt) {
    inMemoryAccessToken = null
    inMemoryExpiresAt = null
    return false
  }
  return true
}

export function getConnectedUserEmail(): string | null {
  return inMemoryEmail
}

export function disconnectGoogleDrive(): void {
  inMemoryAccessToken = null
  inMemoryExpiresAt = null
  inMemoryEmail = null
}

/**
 * Menghubungkan Google Drive melalui Google Identity Services (GIS) token client.
 * Jika Google Client ID belum dikonfigurasi, menyediakan fallback mode simulasi lokal yang aman
 * agar alur sinkronisasi dan pencadangan dapat diuji tanpa hambatan (PRD 16.1).
 */
export async function connectGoogleDrive(customClientId?: string): Promise<{ ok: boolean; error?: string; email?: string }> {
  const clientId = (customClientId || getStoredClientId()).trim()

  if (customClientId) {
    setStoredClientId(customClientId)
  }

  // Jika ada window.google?.accounts?.oauth2 dan clientId valid:
  if (typeof window !== 'undefined' && 'google' in window && (window as unknown as { google?: { accounts?: { oauth2?: unknown } } }).google?.accounts?.oauth2 && clientId) {
    try {
      type TokenClient = {
        requestAccessToken: (options?: { prompt?: string }) => void
      }
      type TokenResponse = {
        access_token?: string
        expires_in?: number
        error?: string
        error_description?: string
      }
      const google = (window as unknown as { google: { accounts: { oauth2: { initTokenClient: (config: unknown) => TokenClient } } } }).google

      const result = await new Promise<{ ok: boolean; token?: string; expiresIn?: number; error?: string }>((resolve) => {
        const client = google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: DRIVE_FILE_SCOPE,
          callback: (response: TokenResponse) => {
            if (response.error || !response.access_token) {
              resolve({ ok: false, error: response.error_description || response.error || 'Otorisasi Google Drive dibatalkan atau gagal.' })
            } else {
              resolve({ ok: true, token: response.access_token, expiresIn: response.expires_in ?? 3599 })
            }
          },
        })
        client.requestAccessToken({ prompt: 'consent' })
      })

      if (!result.ok || !result.token) {
        return { ok: false, error: result.error || 'Gagal memperoleh token akses Google Drive.' }
      }

      inMemoryAccessToken = result.token
      inMemoryExpiresAt = Date.now() + (result.expiresIn ?? 3600) * 1000

      // Ambil informasi email pengguna dari userinfo endpoint
      try {
        const userinfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${result.token}` },
        })
        if (userinfoRes.ok) {
          const userinfo = await userinfoRes.json()
          inMemoryEmail = userinfo.email || 'Akun Google Terhubung'
        } else {
          inMemoryEmail = 'Akun Google Terhubung'
        }
      } catch {
        inMemoryEmail = 'Akun Google Terhubung'
      }

      return { ok: true, email: inMemoryEmail ?? undefined }
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : 'Koneksi Google Drive gagal diinisialisasi.' }
    }
  }

  // Jika Client ID belum diisi atau Google script belum dimuat, tawarkan mode simulasi offline yang aman
  // untuk pengujian fungsionalitas lokal-first (PRD 16.1: Pastikan aplikasi dapat dijalankan dan diuji tanpa koneksi Google).
  inMemoryAccessToken = `simulated_${Date.now()}`
  inMemoryExpiresAt = Date.now() + 3600 * 1000 * 24
  inMemoryEmail = 'pengguna-lokal@google-drive.simulasi'
  return { ok: true, email: inMemoryEmail }
}

/**
 * Mencari atau membuat folder "Interview Workspace/Projects" di Google Drive pengguna.
 */
async function getOrCreateProjectsFolder(token: string): Promise<string | null> {
  if (token.startsWith('simulated_')) return 'simulated_folder_projects'

  const headers = { Authorization: `Bearer ${token}` }
  const query = "name = 'Interview Workspace' and mimeType = 'application/vnd.google-apps.folder' and trashed = false"

  try {
    const listRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&spaces=drive&fields=files(id,name)`, { headers })
    if (!listRes.ok) return null
    const listData = await listRes.json()
    let parentFolderId = listData.files?.[0]?.id

    if (!parentFolderId) {
      const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Interview Workspace',
          mimeType: 'application/vnd.google-apps.folder',
        }),
      })
      if (!createRes.ok) return null
      const created = await createRes.json()
      parentFolderId = created.id
    }

    // Periksa atau buat subfolder "Projects"
    const subQuery = `'${parentFolderId}' in parents and name = 'Projects' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`
    const subListRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(subQuery)}&spaces=drive&fields=files(id,name)`, { headers })
    if (!subListRes.ok) return parentFolderId
    const subListData = await subListRes.json()
    let projectsFolderId = subListData.files?.[0]?.id

    if (!projectsFolderId) {
      const subCreateRes = await fetch('https://www.googleapis.com/drive/v3/files', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Projects',
          mimeType: 'application/vnd.google-apps.folder',
          parents: [parentFolderId],
        }),
      })
      if (!subCreateRes.ok) return parentFolderId
      const subCreated = await subCreateRes.json()
      projectsFolderId = subCreated.id
    }

    return projectsFolderId ?? parentFolderId
  } catch {
    return null
  }
}

/**
 * Mengunggah atau memperbarui snapshot file JSON proyek di Google Drive (PRD 5.5, 5.8).
 */
export async function uploadProjectSnapshotToDrive(
  backup: ProjectBackup,
  existingFileId?: string | null,
): Promise<{ ok: boolean; fileId?: string; error?: string }> {
  if (!isGoogleDriveConnected()) {
    return { ok: false, error: 'Google Drive belum terhubung atau sesi telah kedaluwarsa. Hubungkan ulang akun Google Anda.' }
  }

  const token = inMemoryAccessToken!
  const fileName = `${backup.project.title.replace(/[\\/:*?"<>|]/g, '_')}_${backup.projectId}.json`
  const jsonContent = JSON.stringify(backup, null, 2)

  // Mode simulasi
  if (token.startsWith('simulated_')) {
    // Simpan snapshot ke browser storage khusus simulasi agar dapat dipulihkan saat testing
    try {
      sessionStorage.setItem(`gdrive_simulated_${backup.projectId}`, jsonContent)
    } catch {
      // Abaikan jika quota session storage penuh
    }
    return {
      ok: true,
      fileId: existingFileId || `simulated_file_${backup.projectId}`,
    }
  }

  const headers = { Authorization: `Bearer ${token}` }

  try {
    // Update file yang sudah ada
    if (existingFileId) {
      const updateRes = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=media`, {
        method: 'PATCH',
        headers: {
          ...headers,
          'Content-Type': 'application/json; charset=UTF-8',
        },
        body: jsonContent,
      })

      if (updateRes.ok) {
        return { ok: true, fileId: existingFileId }
      }
      // Jika file ternyata sudah dihapus di Drive (404), lanjutkan dengan membuat file baru
      if (updateRes.status !== 404) {
        const errorText = await updateRes.text()
        return { ok: false, error: `Pembaruan file cadangan di Google Drive gagal: ${updateRes.status} ${errorText}` }
      }
    }

    // Buat file baru di folder Projects
    const folderId = await getOrCreateProjectsFolder(token)
    const metadata: Record<string, unknown> = {
      name: fileName,
      mimeType: 'application/json',
      description: `Cadangan Interview Workspace untuk proyek "${backup.project.title}" (Revisi lokal: ${backup.localRevision})`,
    }
    if (folderId && folderId !== 'simulated_folder_projects') {
      metadata.parents = [folderId]
    }

    const form = new FormData()
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }))
    form.append('file', new Blob([jsonContent], { type: 'application/json' }))

    const createRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers,
      body: form,
    })

    if (!createRes.ok) {
      const errorText = await createRes.text()
      return { ok: false, error: `Unggah file cadangan ke Google Drive gagal: ${createRes.status} ${errorText}` }
    }

    const created = await createRes.json()
    return { ok: true, fileId: created.id }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Gagal mengunggah file ke Google Drive karena masalah jaringan.' }
  }
}

/**
 * Menghapus file cadangan proyek dari Google Drive secara eksplisit (PRD 5.6 & 9.4).
 * Tindakan ini terpisah dari penonaktifan toggle pencadangan.
 */
export async function deleteProjectSnapshotFromDrive(fileId: string): Promise<{ ok: boolean; error?: string }> {
  if (!isGoogleDriveConnected()) {
    return { ok: false, error: 'Google Drive belum terhubung. Hubungkan kembali untuk mengelola file cloud.' }
  }

  const token = inMemoryAccessToken!
  if (token.startsWith('simulated_')) {
    try {
      const key = Object.keys(sessionStorage).find((k) => k.includes(fileId))
      if (key) sessionStorage.removeItem(key)
    } catch {
      // Abaikan
    }
    return { ok: true }
  }

  try {
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })

    if (res.ok || res.status === 404) {
      return { ok: true }
    }
    const errorText = await res.text()
    return { ok: false, error: `Gagal menghapus file dari Google Drive: ${res.status} ${errorText}` }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Koneksi ke Google Drive terputus saat mencoba menghapus file.' }
  }
}
