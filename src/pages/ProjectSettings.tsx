import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { ProjectDialog } from '../components/ProjectDialog'
import {
  Badge,
  Button,
  Checkbox,
  ConfirmDialog,
  InlineNotice,
  Modal,
  SaveIndicator,
  Switch,
  useToast,
} from '../components/ui'
import { SCHEMA_VERSION, parseProjectBackup, summarizeProjectBackup, type BackupSummary } from '../lib/backup'
import { usePageTitle, useProject } from '../lib/hooks'
import { projectSessions, projectStats } from '../lib/selectors'
import { useWorkspace } from '../lib/store'
import { formatDate, relativeTime } from '../lib/utils'

type RestoreMode = 'new' | 'replace'

interface RestorePreview {
  fileName: string
  json: string
  summary: BackupSummary
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line py-2 last:border-0">
      <dt className="text-xs text-ink-muted">{label}</dt>
      <dd className="text-right text-[13px] font-medium text-ink">{value}</dd>
    </div>
  )
}

export function ProjectSettings() {
  const project = useProject()
  const {
    data,
    saveState,
    retrySave,
    setProjectBackup,
    exportProjectBackup,
    restoreProjectBackup,
    syncProject,
    deleteCloudBackup,
    googleDriveConnected,
    googleAccount,
    connectDrive,
  } = useWorkspace()
  const { notify } = useToast()
  const navigate = useNavigate()
  const fileInput = useRef<HTMLInputElement>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [deletingCloud, setDeletingCloud] = useState(false)
  const [confirmDeleteCloudOpen, setConfirmDeleteCloudOpen] = useState(false)
  const [restoreError, setRestoreError] = useState<string | null>(null)
  const [preview, setPreview] = useState<RestorePreview | null>(null)
  const [mode, setMode] = useState<RestoreMode>('new')
  const [confirmReplace, setConfirmReplace] = useState(false)

  usePageTitle(project ? `Pengaturan · ${project.title}` : 'Pengaturan proyek')

  const stats = useMemo(() => (project ? projectStats(data, project.id) : null), [data, project])
  const sessionCount = useMemo(() => (project ? projectSessions(data, project.id).length : 0), [data, project])

  if (!project || !stats) return null

  const backupLabel = project.backupEnabled
    ? (project.syncStatus ?? 'Menunggu sinkronisasi')
    : 'Belum dicadangkan'
  const backupTone =
    project.syncStatus === 'Tersinkron ke Google Drive'
      ? 'success'
      : project.syncStatus === 'Gagal menyinkronkan' || project.syncStatus === 'Konflik'
        ? 'danger'
        : project.backupEnabled
          ? 'warn'
          : 'neutral'

  const handleToggleBackup = async (enabled: boolean) => {
    const ok = await setProjectBackup(project.id, enabled)
    if (!ok) {
      notify('Preferensi pencadangan belum tersimpan. Periksa ruang penyimpanan lalu coba lagi.', 'error')
      return
    }
    notify(enabled ? 'Preferensi pencadangan diaktifkan.' : 'Preferensi pencadangan dinonaktifkan.')
  }

  const handleDownload = () => {
    const ok = exportProjectBackup(project.id)
    notify(
      ok ? 'Backup JSON proyek diunduh. Simpan file di tempat yang aman.' : 'Backup tidak dapat dibuat karena proyek tidak ditemukan.',
      ok ? 'success' : 'error',
    )
  }

  const handleSyncNow = async () => {
    if (!googleDriveConnected) {
      const res = await connectDrive()
      if (!res.ok) {
        notify(res.error ?? 'Gagal menghubungkan Google Drive.', 'error')
        return
      }
    }
    setSyncing(true)
    try {
      const res = await syncProject(project.id)
      if (res.ok) {
        notify('Proyek berhasil disinkronkan ke Google Drive.', 'success')
      } else {
        notify(res.error ?? 'Sinkronisasi ke Google Drive gagal.', 'error')
      }
    } finally {
      setSyncing(false)
    }
  }

  const handleDeleteCloud = async () => {
    setDeletingCloud(true)
    try {
      const res = await deleteCloudBackup(project.id)
      if (res.ok) {
        notify('Salinan cadangan di Google Drive berhasil dihapus. Data lokal tetap utuh.', 'success')
        setConfirmDeleteCloudOpen(false)
      } else {
        notify(res.error ?? 'Gagal menghapus file dari Google Drive.', 'error')
      }
    } finally {
      setDeletingCloud(false)
    }
  }

  const handleFile = async (file: File | undefined) => {
    setRestoreError(null)
    if (!file) return
    try {
      const json = await file.text()
      const parsed = parseProjectBackup(json)
      if (!parsed.ok) {
        setRestoreError(parsed.error)
        return
      }
      setPreview({ fileName: file.name, json, summary: summarizeProjectBackup(parsed.value) })
      setMode('new')
      setConfirmReplace(false)
    } catch {
      setRestoreError('File tidak dapat dibaca. Pastikan file JSON tidak rusak dan dapat diakses.')
    } finally {
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  const confirmRestore = async () => {
    if (!preview) return
    setBusy(true)
    setRestoreError(null)
    try {
      const result = await restoreProjectBackup(preview.json, mode, mode === 'replace' ? project.id : undefined)
      if (!result.ok) {
        setRestoreError(result.error ?? 'Pemulihan gagal.')
        return
      }
      setPreview(null)
      notify(mode === 'replace' ? 'Proyek berhasil dipulihkan dari backup.' : 'Backup dipulihkan sebagai proyek baru.', 'success')
      if (mode === 'new' && result.projectId) {
        navigate(`/p/${result.projectId}/pengaturan`)
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <header className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-ink sm:text-[27px]">
            Pengaturan proyek
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-ink-soft">
            Kelola informasi proyek, status penyimpanan lokal, dan pencadangan data.
          </p>
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <Badge tone={project.status === 'Selesai' ? 'success' : 'neutral'} dot>
              {project.status}
            </Badge>
            <Badge tone={backupTone} dot>
              {backupLabel}
            </Badge>
            <span className="text-xs text-ink-muted">Revisi lokal {project.localRevision}</span>
          </div>
        </div>
        <Button variant="secondary" icon="edit" onClick={() => setEditOpen(true)}>
          Ubah detail proyek
        </Button>
      </header>

      <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
        <section className="rounded-[12px] border border-line bg-surface">
          <div className="border-b border-line px-4 py-3">
            <h2 className="text-[13px] font-semibold text-ink">Informasi proyek</h2>
          </div>
          <dl className="px-4 py-2">
            <MetaRow label="Nama proyek" value={project.title} />
            <MetaRow label="Dibuat" value={formatDate(project.createdAt)} />
            <MetaRow label="Terakhir diubah" value={`${formatDate(project.updatedAt, true)} (${relativeTime(project.updatedAt)})`} />
            <MetaRow label="Pertanyaan" value={`${stats.activeQuestions} aktif dari ${stats.questions}`} />
            <MetaRow label="Narasumber" value={String(stats.respondents)} />
            <MetaRow label="Sesi" value={`${sessionCount} sesi, ${stats.completedSessions} selesai`} />
            <MetaRow label="Jawaban terisi" value={`${stats.answersFilled} dari ${stats.answersTotal}`} />
          </dl>
        </section>

        <section className="rounded-[12px] border border-line bg-surface">
          <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
            <h2 className="text-[13px] font-semibold text-ink">Status penyimpanan lokal</h2>
            <Badge tone="success" dot>
              IndexedDB
            </Badge>
          </div>
          <div className="space-y-3 px-4 py-3.5">
            <p className="text-sm leading-relaxed text-ink-soft">
              Seluruh data proyek disimpan di perangkat ini. Tidak ada data yang dikirim ke server aplikasi.
            </p>
            <div className="flex items-center justify-between gap-3 rounded-[9px] border border-line bg-surface-2/60 px-3 py-2">
              <span className="text-xs text-ink-muted">Status simpan otomatis</span>
              <SaveIndicator state={saveState} onRetry={retrySave} />
            </div>
            <p className="text-xs leading-relaxed text-ink-muted">
              Data lokal dapat hilang jika penyimpanan browser dibersihkan atau perangkat rusak. Unduh backup JSON
              secara berkala dan simpan di tempat terpisah.
            </p>
          </div>
        </section>

        <section className="rounded-[12px] border border-line bg-surface lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
            <div>
              <h2 className="text-[13px] font-semibold text-ink">Pencadangan proyek</h2>
              <p className="mt-0.5 text-xs text-ink-muted">
                Penyimpanan utama selalu di IndexedDB. Google Drive menyimpan salinan snapshot proyek JSON opsional.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge tone={googleDriveConnected ? 'success' : 'neutral'} dot>
                {googleDriveConnected ? (googleAccount ? `Drive: ${googleAccount}` : 'Drive terhubung') : 'Drive belum terhubung'}
              </Badge>
              <Badge tone={backupTone} dot>
                {backupLabel}
              </Badge>
            </div>
          </div>

          <div className="space-y-4 px-4 py-4">
            <Switch
              id="project-backup-switch"
              checked={project.backupEnabled}
              onChange={(value) => void handleToggleBackup(value)}
              label="Cadangkan proyek ini ke Google Drive (opsional)"
              description="Menonaktifkan backup menghentikan pengiriman perubahan berikutnya, namun tidak menghapus file cadangan yang sudah ada di Drive."
            />

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-[9px] border border-line bg-surface-2/60 px-3 py-2.5">
                <p className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">Backup terakhir</p>
                <p className="mt-1 text-[13px] text-ink">
                  {project.lastSyncedAt ? formatDate(project.lastSyncedAt, true) : 'Belum ada backup cloud'}
                </p>
              </div>
              <div className="rounded-[9px] border border-line bg-surface-2/60 px-3 py-2.5">
                <p className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">Revisi lokal</p>
                <p className="mt-1 text-[13px] text-ink">
                  {project.localRevision}
                  {project.lastSyncedRevision ? ` · tersinkron: ${project.lastSyncedRevision}` : ''}
                </p>
              </div>
            </div>

            {project.lastSyncError ? (
              <InlineNotice tone="warn" title="Kesalahan sinkronisasi terakhir">
                {project.lastSyncError}
              </InlineNotice>
            ) : null}

            {project.backupEnabled ? (
              <div className="flex flex-wrap items-center gap-2.5 rounded-[9px] border border-line bg-surface-2/30 p-3">
                <Button
                  variant="primary"
                  icon="refresh"
                  onClick={() => void handleSyncNow()}
                  disabled={syncing}
                >
                  {syncing ? 'Menyinkronkan…' : 'Sinkronkan sekarang'}
                </Button>
                {project.remoteFileId ? (
                  <Button
                    variant="danger"
                    icon="trash"
                    onClick={() => setConfirmDeleteCloudOpen(true)}
                    disabled={deletingCloud || syncing}
                  >
                    Hapus salinan di Google Drive
                  </Button>
                ) : null}
                <span className="text-xs text-ink-muted">
                  Sinkronisasi mengirim snapshot file JSON proyek ke folder Interview Workspace/Projects di Google Drive Anda.
                </span>
              </div>
            ) : project.remoteFileId ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-[9px] border border-warn/30 bg-warn/10 p-3">
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-ink">Salinan cadangan lama masih tersimpan di Google Drive</p>
                  <p className="mt-0.5 text-xs text-ink-muted">Pencadangan dinonaktifkan, tetapi file snapshot lama di Drive tidak dihapus otomatis.</p>
                </div>
                <Button
                  variant="danger"
                  size="sm"
                  icon="trash"
                  onClick={() => setConfirmDeleteCloudOpen(true)}
                  disabled={deletingCloud}
                >
                  Hapus salinan cloud
                </Button>
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3.5">
              <Button variant="secondary" icon="download" onClick={handleDownload}>
                Unduh backup JSON lokal
              </Button>
              <Button
                variant="secondary"
                icon="upload"
                onClick={() => {
                  setRestoreError(null)
                  fileInput.current?.click()
                }}
              >
                Pulihkan dari JSON
              </Button>
              <span className="text-xs text-ink-muted">Format file: JSON · skema versi {SCHEMA_VERSION}</span>
              <input
                ref={fileInput}
                type="file"
                accept="application/json,.json"
                className="sr-only"
                onChange={(event) => void handleFile(event.target.files?.[0])}
              />
            </div>

            {restoreError ? (
              <InlineNotice tone="danger" title="File tidak dapat dipulihkan">
                {restoreError}
              </InlineNotice>
            ) : null}

            <p className="text-xs leading-relaxed text-ink-muted">
              Backup JSON memuat data proyek, dokumen sumber, pertanyaan, narasumber, sesi, jawaban, kode, kategori,
              tema, bukti tema, dan memo analisis. Metadata sinkronisasi tidak disertakan.
            </p>
          </div>
        </section>
      </div>

      <ProjectDialog open={editOpen} onClose={() => setEditOpen(false)} project={project} />

      <Modal
        open={Boolean(preview)}
        onClose={() => (busy ? undefined : setPreview(null))}
        title="Pulihkan proyek dari backup"
        description={preview ? `File: ${preview.fileName}` : undefined}
        size="lg"
        preventClose={busy}
        footer={
          <>
            <Button onClick={() => setPreview(null)} disabled={busy}>
              Batal
            </Button>
            <Button
              variant="primary"
              onClick={() => void confirmRestore()}
              disabled={busy || (mode === 'replace' && !confirmReplace)}
            >
              {busy ? 'Memulihkan…' : mode === 'replace' ? 'Ganti proyek ini' : 'Pulihkan sebagai proyek baru'}
            </Button>
          </>
        }
      >
        {preview ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 rounded-[10px] border border-line bg-surface-2/60 p-3 text-sm sm:grid-cols-3">
              {[
                ['Dokumen', preview.summary.documents],
                ['Pertanyaan', preview.summary.questions],
                ['Narasumber', preview.summary.respondents],
                ['Sesi', preview.summary.sessions],
                ['Jawaban terisi', preview.summary.answers],
                ['Kode', preview.summary.codes],
                ['Kategori', preview.summary.categories],
                ['Tema', preview.summary.themes],
              ].map(([label, value]) => (
                <div key={String(label)}>
                  <p className="text-[11px] uppercase tracking-wide text-ink-muted">{label}</p>
                  <p className="text-[13px] font-semibold text-ink">{value}</p>
                </div>
              ))}
            </div>

            <div className="space-y-1 text-xs text-ink-muted">
              <p>Proyek: {preview.summary.title}</p>
              <p>Diekspor: {formatDate(preview.summary.exportedAt, true)}</p>
              <p>Skema: versi {preview.summary.schemaVersion}</p>
            </div>

            <div className="space-y-2" role="radiogroup" aria-label="Cara memulihkan">
              <label className="flex cursor-pointer items-start gap-2.5 rounded-[9px] border border-line px-3 py-2.5">
                <input
                  type="radio"
                  name="restore-mode"
                  className="mt-0.5 h-4 w-4 accent-[var(--primary)]"
                  checked={mode === 'new'}
                  onChange={() => {
                    setMode('new')
                    setConfirmReplace(false)
                  }}
                />
                <span className="text-sm text-ink">
                  Pulihkan sebagai proyek baru
                  <span className="mt-0.5 block text-xs leading-relaxed text-ink-muted">
                    Data proyek saat ini tidak diubah. Backup mendapat ID baru dan dapat dibuka terpisah.
                  </span>
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-2.5 rounded-[9px] border border-line px-3 py-2.5">
                <input
                  type="radio"
                  name="restore-mode"
                  className="mt-0.5 h-4 w-4 accent-[var(--primary)]"
                  checked={mode === 'replace'}
                  onChange={() => setMode('replace')}
                />
                <span className="text-sm text-ink">
                  Ganti proyek ini dengan isi backup
                  <span className="mt-0.5 block text-xs leading-relaxed text-ink-muted">
                    Seluruh data proyek ini akan diganti. Data proyek lain tidak terpengaruh. Tindakan ini tidak dapat
                    dibatalkan tanpa backup.
                  </span>
                </span>
              </label>
            </div>

            {mode === 'replace' ? (
              <div className="space-y-2 rounded-[9px] border border-danger/30 bg-danger-soft/40 px-3 py-2.5">
                <Checkbox
                  id="confirm-replace"
                  label="Saya memahami data proyek ini akan diganti dan telah menyiapkan backup."
                  checked={confirmReplace}
                  onChange={(event) => setConfirmReplace(event.target.checked)}
                />
                <p className="flex items-start gap-1.5 text-xs leading-relaxed text-danger">
                  <Icon name="alert" size={13} className="mt-0.5 shrink-0" />
                  Pemulihan memakai satu transaksi; jika penyimpanan gagal, data lama tetap utuh.
                </p>
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={confirmDeleteCloudOpen}
        onClose={() => setConfirmDeleteCloudOpen(false)}
        onConfirm={() => void handleDeleteCloud()}
        busy={deletingCloud}
        tone="danger"
        title="Hapus salinan proyek di Google Drive?"
        description={`Salinan file "${project.title}" pada Google Drive akan dihapus permanen.`}
        impact="Data proyek di IndexedDB perangkat ini tetap tersimpan utuh dan tidak terhapus. Anda dapat mencadangkan ulang proyek kapan saja."
        confirmLabel="Hapus dari Google Drive"
      />
    </div>
  )
}
