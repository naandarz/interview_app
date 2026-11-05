import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePageTitle } from '../lib/hooks'
import { useWorkspace } from '../lib/store'
import { parseWorkspaceBackup } from '../lib/backup'
import type { WorkspaceData } from '../lib/types'
import { getStoredClientId, setStoredClientId } from '../lib/googleDrive'
import { useTheme, PALETTE_OPTIONS, type ThemeMode } from '../lib/theme'
import { bytes, formatDate } from '../lib/utils'
import { Icon, type IconName } from '../components/Icon'
import {
  Badge,
  Button,
  ConfirmDialog,
  Field,
  InlineNotice,
  Input,
  Modal,
  PageHeader,
  Progress,
  Spinner,
  cx,
  useToast,
} from '../components/ui'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const THEME_OPTIONS: Array<{ mode: ThemeMode; label: string; description: string; icon: IconName }> = [
  { mode: 'light', label: 'Terang', description: 'Latar kertas untuk ruangan terang.', icon: 'sun' },
  { mode: 'dark', label: 'Gelap', description: 'Kontras rendah untuk ruangan redup.', icon: 'moon' },
  { mode: 'system', label: 'Ikuti sistem', description: 'Mengikuti pengaturan perangkat.', icon: 'monitor' },
]

interface RestorePreview {
  json: string
  exportedAt: string | null
  projects: number
  respondents: number
  sessions: number
  answers: number
  questions: number
  profileName: string | null
}

function SectionCard({
  id,
  number,
  title,
  description,
  children,
  className,
}: {
  id: string
  number: string
  title: string
  description: string
  children: ReactNode
  className?: string
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className={cx('rounded-[12px] border border-line bg-surface', className)}>
      <div className="flex items-start gap-3 border-b border-line px-4 py-3.5 sm:px-5">
        <span className="mono-meta mt-0.5 shrink-0 rounded bg-surface-2 px-1.5 py-0.5 text-[10px] text-ink-muted">
          {number}
        </span>
        <div className="min-w-0">
          <h2 id={`${id}-title`} className="text-[15px] font-semibold text-ink">
            {title}
          </h2>
          <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">{description}</p>
        </div>
      </div>
      <div className="px-4 py-4 sm:px-5">{children}</div>
    </section>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[8px] border border-line bg-surface-2/40 px-3 py-2.5">
      <p className="mono-meta uppercase text-ink-muted">{label}</p>
      <p className="mt-1 text-[18px] font-semibold leading-none tracking-[-0.02em] text-ink">{value}</p>
    </div>
  )
}

function countRows(data: WorkspaceData) {
  return {
    projects: data.projects.length,
    questions: data.questions.length,
    respondents: data.respondents.length,
    sessions: data.sessions.length,
    answers: data.answers.filter((answer) => answer.text.trim().length > 0).length,
    documents: data.documents.length,
    codes: data.codes.length,
    themes: data.themes.length,
    memos: data.memos.length,
    exports: data.exports.length,
  }
}

export function Settings() {
  const {
    data,
    profile,
    saveProfile,
    backupWorkspace,
    restoreWorkspace,
    loadDemo,
    resetAll,
    googleDriveConnected,
    googleAccount,
    connectDrive,
    disconnectDrive,
  } = useWorkspace()
  const { mode, setMode, palette, setPalette } = useTheme()
  const { notify } = useToast()
  const navigate = useNavigate()
  usePageTitle('Pengaturan')

  const [form, setForm] = useState({ name: '', email: '', institution: '' })
  const [errors, setErrors] = useState<Partial<Record<'name' | 'email' | 'institution', string>>>({})
  const [savingProfile, setSavingProfile] = useState(false)

  const [driveClientId, setDriveClientId] = useState(() => getStoredClientId())
  const [connectingDrive, setConnectingDrive] = useState(false)

  const [estimate, setEstimate] = useState<{ usage: number; quota: number } | null>(null)
  const [estimateError, setEstimateError] = useState(false)
  const [persisted, setPersisted] = useState<boolean | null>(null)
  const [askingPersist, setAskingPersist] = useState(false)

  const [restorePreview, setRestorePreview] = useState<RestorePreview | null>(null)
  const [restoreError, setRestoreError] = useState<string | null>(null)
  const [restoring, setRestoring] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  const [demoOpen, setDemoOpen] = useState(false)
  const [loadingDemo, setLoadingDemo] = useState(false)

  const [resetOpen, setResetOpen] = useState(false)
  const [resetPhrase, setResetPhrase] = useState('')
  const [resetting, setResetting] = useState(false)

  useEffect(() => {
    setForm({
      name: profile?.name ?? '',
      email: profile?.email ?? '',
      institution: profile?.institution ?? '',
    })
  }, [profile])

  const refreshStorage = async () => {
    if (!('storage' in navigator) || !navigator.storage?.estimate) {
      setEstimateError(true)
      return
    }
    try {
      const result = await navigator.storage.estimate()
      setEstimate({ usage: result.usage ?? 0, quota: result.quota ?? 0 })
      setEstimateError(false)
      if (navigator.storage.persisted) setPersisted(await navigator.storage.persisted())
    } catch {
      setEstimateError(true)
    }
  }

  useEffect(() => {
    void refreshStorage()
  }, [])

  const handleConnectDrive = async () => {
    setConnectingDrive(true)
    try {
      const res = await connectDrive(driveClientId)
      if (res.ok) {
        notify('Google Drive berhasil terhubung.', 'success')
      } else {
        notify(res.error ?? 'Gagal menghubungkan Google Drive.', 'error')
      }
    } finally {
      setConnectingDrive(false)
    }
  }

  const handleDisconnectDrive = () => {
    disconnectDrive()
    notify('Koneksi Google Drive diputuskan. Seluruh data lokal tetap tersimpan utuh.')
  }

  const counts = useMemo(() => countRows(data), [data])
  const usagePercent = estimate && estimate.quota > 0 ? Math.min(100, (estimate.usage / estimate.quota) * 100) : 0
  const demoExists = data.projects.some((project) => project.description.startsWith('Data contoh.'))
  const initials = (profile?.name ?? 'IW')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')

  const setField = (key: 'name' | 'email' | 'institution', value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  const submitProfile = async () => {
    const next: typeof errors = {}
    const name = form.name.trim()
    const email = form.email.trim()
    if (!name) next.name = 'Nama wajib diisi.'
    else if (name.length < 2) next.name = 'Gunakan minimal 2 karakter.'
    else if (name.length > 80) next.name = 'Nama maksimal 80 karakter.'
    if (!email) next.email = 'Email wajib diisi untuk identitas ruang kerja.'
    else if (!EMAIL_PATTERN.test(email)) next.email = 'Format email belum benar, misalnya nama@contoh.id.'
    else if (email.length > 120) next.email = 'Email maksimal 120 karakter.'
    if (form.institution.length > 120) next.institution = 'Institusi maksimal 120 karakter.'
    setErrors(next)
    if (Object.keys(next).length > 0) return

    setSavingProfile(true)
    try {
      await saveProfile({ name, email, institution: form.institution.trim() })
      notify('Profil ruang kerja diperbarui.')
    } catch {
      notify('Profil tidak dapat disimpan. Periksa penyimpanan browser lalu coba lagi.', 'error')
    } finally {
      setSavingProfile(false)
    }
  }

  const requestPersist = async () => {
    if (!navigator.storage?.persist) {
      notify('Browser ini tidak menyediakan opsi penyimpanan permanen.', 'info')
      return
    }
    setAskingPersist(true)
    try {
      const granted = await navigator.storage.persist()
      setPersisted(granted)
      notify(
        granted
          ? 'Penyimpanan permanen diberikan. Data lebih kecil kemungkinannya dibersihkan browser.'
          : 'Browser belum memberikan penyimpanan permanen. Cadangkan data secara berkala.',
        granted ? 'success' : 'info',
      )
    } catch {
      notify('Permintaan penyimpanan permanen tidak dapat diproses.', 'error')
    } finally {
      setAskingPersist(false)
    }
  }

  const handleRestoreFile = async (file: File | undefined) => {
    setRestoreError(null)
    if (!file) return
    if (file.size > 25 * 1024 * 1024) {
      setRestoreError('Ukuran cadangan melebihi 25 MB. Pecah data atau gunakan cadangan yang lebih kecil.')
      return
    }
    try {
      const json = await file.text()
      const parsed = parseWorkspaceBackup(json)
      if (!parsed.ok) {
        setRestoreError(parsed.error)
        return
      }
      const { data, profile, exportedAt } = parsed.value
      setRestorePreview({
        json,
        exportedAt: exportedAt ?? null,
        projects: data.projects.length,
        questions: data.questions.length,
        respondents: data.respondents.length,
        sessions: data.sessions.length,
        answers: data.answers.filter((answer) => answer.text.trim().length > 0).length,
        profileName: profile?.name?.trim() || null,
      })
    } catch {
      setRestoreError('File tidak dapat dibaca. Pastikan file JSON cadangan tidak rusak.')
    } finally {
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  const confirmRestore = async () => {
    if (!restorePreview) return
    setRestoring(true)
    try {
      const result = await restoreWorkspace(restorePreview.json)
      if (!result.ok) {
        setRestoreError(result.error ?? 'Cadangan tidak dapat dipulihkan.')
        setRestorePreview(null)
        notify('Cadangan gagal dipulihkan.', 'error')
        return
      }
      setRestorePreview(null)
      notify('Cadangan dipulihkan. Data saat ini diganti dengan isi cadangan.')
      navigate('/')
    } finally {
      setRestoring(false)
    }
  }

  const confirmDemo = async () => {
    setLoadingDemo(true)
    try {
      const projectId = await loadDemo()
      setDemoOpen(false)
      if (projectId) {
        notify('Data contoh ditambahkan sebagai proyek terpisah.')
        navigate(`/p/${projectId}`)
      } else {
        notify('Data contoh tidak dapat dimuat.', 'error')
      }
    } finally {
      setLoadingDemo(false)
    }
  }

  const confirmReset = async () => {
    if (resetPhrase.trim().toUpperCase() !== 'HAPUS') return
    setResetting(true)
    try {
      await resetAll()
      setResetOpen(false)
      setResetPhrase('')
      notify('Seluruh data dan profil di perangkat ini telah dihapus.')
      navigate('/')
    } finally {
      setResetting(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Pengaturan ruang kerja"
        description="Kelola identitas, tampilan, penyimpanan, dan cadangan. Semua pengaturan berlaku pada perangkat ini."
        meta={
          <>
            <Badge tone="neutral" dot>
              Penyimpanan lokal
            </Badge>
            <span className="mono-meta">Versi 1.0.0</span>
          </>
        }
        actions={
          <Button variant="secondary" icon="download" onClick={backupWorkspace}>
            Cadangkan sekarang
          </Button>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
        <div className="min-w-0 space-y-5">
          <SectionCard
            id="pengaturan-profil"
            number="01"
            title="Profil ruang kerja"
            description="Nama dan email dipakai sebagai identitas lokal. Tidak ada akun daring yang dibuat."
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary-soft text-[17px] font-semibold text-primary">
                {initials || 'IW'}
              </div>
              <form
                className="min-w-0 flex-1 space-y-4"
                onSubmit={(event) => {
                  event.preventDefault()
                  void submitProfile()
                }}
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Nama" htmlFor="settings-name" required error={errors.name}>
                    <Input
                      id="settings-name"
                      value={form.name}
                      onChange={(event) => setField('name', event.target.value)}
                      autoComplete="name"
                      maxLength={80}
                      invalid={Boolean(errors.name)}
                    />
                  </Field>
                  <Field label="Email" htmlFor="settings-email" required error={errors.email} hint="Dipakai hanya sebagai label identitas.">
                    <Input
                      id="settings-email"
                      type="email"
                      value={form.email}
                      onChange={(event) => setField('email', event.target.value)}
                      autoComplete="email"
                      maxLength={120}
                      invalid={Boolean(errors.email)}
                    />
                  </Field>
                </div>
                <Field
                  label="Institusi atau komunitas"
                  htmlFor="settings-institution"
                  optional
                  error={errors.institution}
                  hint="Contoh: Universitas, tim riset, atau organisasi."
                >
                  <Input
                    id="settings-institution"
                    value={form.institution}
                    onChange={(event) => setField('institution', event.target.value)}
                    autoComplete="organization"
                    maxLength={120}
                    invalid={Boolean(errors.institution)}
                  />
                </Field>
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="submit" variant="primary" icon="save" disabled={savingProfile}>
                    {savingProfile ? <Spinner size={15} /> : null}
                    {savingProfile ? 'Menyimpan…' : 'Simpan profil'}
                  </Button>
                  <p className="text-[11px] leading-relaxed text-ink-muted">
                    Profil tersimpan di IndexedDB perangkat ini, bukan di server.
                  </p>
                </div>
                <button type="submit" className="hidden" tabIndex={-1} aria-hidden="true">
                  Simpan profil
                </button>
              </form>
            </div>
          </SectionCard>

          <SectionCard
            id="pengaturan-tampilan"
            number="02"
            title="Tampilan & Warna"
            description="Pilih mode tampilan dan tema palet warna yang paling nyaman dan menarik untuk sesi kerja Anda."
          >
            <div className="space-y-6">
              <div>
                <p className="text-[13px] font-medium text-ink">Mode Tampilan</p>
                <p className="text-[12px] text-ink-muted mb-2.5">Atur kontras terang atau gelap untuk kenyamanan mata.</p>
                <div role="radiogroup" aria-label="Mode tampilan" className="grid gap-2 sm:grid-cols-3">
                  {THEME_OPTIONS.map((option) => {
                    const active = mode === option.mode
                    return (
                      <button
                        key={option.mode}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => setMode(option.mode)}
                        className={cx(
                          'flex min-h-20 items-start gap-2.5 rounded-[9px] border px-3 py-3 text-left transition-colors duration-150',
                          active ? 'border-primary bg-primary-soft/60' : 'border-line bg-surface hover:border-line-strong hover:bg-surface-2/60',
                        )}
                      >
                        <span
                          className={cx(
                            'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md',
                            active ? 'bg-primary text-primary-ink' : 'bg-surface-2 text-ink-muted',
                          )}
                        >
                          <Icon name={option.icon} size={16} />
                        </span>
                        <span className="min-w-0">
                          <span className={cx('block text-[13px] font-semibold', active ? 'text-primary' : 'text-ink')}>
                            {option.label}
                          </span>
                          <span className="mt-0.5 block text-[11px] leading-snug text-ink-muted">{option.description}</span>
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <p className="text-[13px] font-medium text-ink">Palet Aksen Warna</p>
                <p className="text-[12px] text-ink-muted mb-2.5">Pilih warna aksen utama yang memandu navigasi, tombol penting, dan penanda data.</p>
                <div role="radiogroup" aria-label="Palet warna aksen" className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                  {PALETTE_OPTIONS.map((pal) => {
                    const active = palette === pal.id
                    return (
                      <button
                        key={pal.id}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => setPalette(pal.id)}
                        className={cx(
                          'flex items-start gap-3 rounded-[9px] border p-3 text-left transition-all duration-150',
                          active
                            ? 'border-primary bg-primary-soft/40 shadow-sm ring-1 ring-primary'
                            : 'border-line bg-surface hover:border-line-strong hover:bg-surface-2/60',
                        )}
                      >
                        <span
                          className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full shadow-sm text-white"
                          style={{ backgroundColor: pal.color }}
                        >
                          {active ? <Icon name="check" size={14} /> : null}
                        </span>
                        <div className="min-w-0">
                          <span className={cx('block text-[13px] font-semibold', active ? 'text-primary' : 'text-ink')}>
                            {pal.name}
                          </span>
                          <span className="mt-0.5 block text-[11px] leading-snug text-ink-muted">
                            {pal.description}
                          </span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            id="pengaturan-penyimpanan"
            number="03"
            title="Penyimpanan"
            description="Data disimpan di IndexedDB browser. Perkiraan pemakaian mencakup seluruh data aplikasi pada alamat ini."
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="mono-meta uppercase text-ink-muted">Perkiraan pemakaian</p>
                <p className="mt-1 text-[20px] font-semibold leading-none tracking-[-0.02em] text-ink">
                  {estimate ? bytes(estimate.usage) : 'Belum tersedia'}
                  {estimate && estimate.quota > 0 ? (
                    <span className="ml-1 text-[12px] font-normal text-ink-muted">dari {bytes(estimate.quota)}</span>
                  ) : null}
                </p>
              </div>
              <Button size="sm" variant="secondary" icon="refresh" onClick={() => void refreshStorage()}>
                Perbarui angka
              </Button>
            </div>
            <Progress
              value={usagePercent}
              className="mt-2.5"
              label={`Pemakaian penyimpanan ${usagePercent.toFixed(1)} persen`}
            />
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-ink-muted">
              <span>{estimate && estimate.quota > 0 ? `${usagePercent.toFixed(1)}% dari kuota browser` : 'Kuota tidak dilaporkan browser.'}</span>
              <span className="inline-flex items-center gap-1.5">
                <Icon name={persisted ? 'lock' : 'database'} size={12} />
                {persisted === null
                  ? 'Status penyimpanan permanen tidak tersedia'
                  : persisted
                    ? 'Penyimpanan permanen aktif'
                    : 'Belum ada penyimpanan permanen'}
              </span>
            </div>
            {estimateError ? (
              <InlineNotice tone="warn" className="mt-3">
                Browser tidak memberi perkiraan penyimpanan. Data tetap tersimpan, tetapi pantau kapasitas perangkat
                secara manual.
              </InlineNotice>
            ) : null}
            {!persisted ? (
              <Button
                className="mt-3"
                size="sm"
                variant="secondary"
                icon="lock"
                onClick={() => void requestPersist()}
                disabled={askingPersist}
              >
                {askingPersist ? <Spinner size={14} /> : null}
                {askingPersist ? 'Meminta izin…' : 'Minta penyimpanan permanen'}
              </Button>
            ) : null}

            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
              <Stat label="Proyek" value={counts.projects} />
              <Stat label="Pertanyaan" value={counts.questions} />
              <Stat label="Narasumber" value={counts.respondents} />
              <Stat label="Sesi" value={counts.sessions} />
              <Stat label="Jawaban terisi" value={counts.answers} />
              <Stat label="Dokumen" value={counts.documents} />
              <Stat label="Kode" value={counts.codes} />
              <Stat label="Tema" value={counts.themes} />
              <Stat label="Riwayat ekspor" value={counts.exports} />
            </div>
          </SectionCard>

          <SectionCard
            id="pengaturan-google-drive"
            number="04"
            title="Google Drive (Pencadangan Cloud Opsional)"
            description="Cadangkan salinan proyek ke folder Interview Workspace di Google Drive milik Anda sendiri. Data operasional utama tetap tersimpan di perangkat ini."
          >
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-[9px] border border-line bg-surface-2/40 p-3.5">
                <div>
                  <p className="text-[13px] font-semibold text-ink">Status Koneksi Google Drive</p>
                  <p className="mt-0.5 text-xs text-ink-muted">
                    {googleDriveConnected
                      ? googleAccount
                        ? `Terhubung sebagai ${googleAccount}`
                        : 'Terhubung ke Google Drive'
                      : 'Google Drive belum terhubung. Pencadangan cloud dinonaktifkan.'}
                  </p>
                </div>
                <Badge tone={googleDriveConnected ? 'success' : 'neutral'} dot>
                  {googleDriveConnected ? 'Terhubung' : 'Belum terhubung'}
                </Badge>
              </div>

              <Field
                label="Google OAuth Client ID"
                htmlFor="google-client-id"
                optional
                hint="Disediakan untuk menghubungkan ke Google Cloud Console Anda sendiri. Jika dikosongkan, mode simulasi offline aktif untuk pengujian aman."
              >
                <Input
                  id="google-client-id"
                  value={driveClientId}
                  onChange={(event) => {
                    const val = event.target.value
                    setDriveClientId(val)
                    setStoredClientId(val)
                  }}
                  placeholder="Contoh: 123456789-abcdef.apps.googleusercontent.com"
                />
              </Field>

              <div className="flex flex-wrap items-center gap-2.5">
                <Button
                  variant={googleDriveConnected ? 'secondary' : 'primary'}
                  icon={googleDriveConnected ? 'refresh' : 'upload'}
                  onClick={() => void handleConnectDrive()}
                  disabled={connectingDrive}
                >
                  {connectingDrive ? (
                    <Spinner size={14} />
                  ) : null}
                  {connectingDrive
                    ? 'Menghubungkan…'
                    : googleDriveConnected
                      ? 'Hubungkan ulang akun'
                      : 'Hubungkan Google Drive'}
                </Button>
                {googleDriveConnected ? (
                  <Button
                    variant="danger"
                    icon="trash"
                    onClick={handleDisconnectDrive}
                  >
                    Putuskan koneksi
                  </Button>
                ) : null}
              </div>

              <div className="rounded-[9px] border border-line bg-surface-2/30 p-3 text-xs leading-relaxed text-ink-muted">
                <p className="font-medium text-ink">Keamanan & Privasi (PRD 6.1 & 6.2):</p>
                <ul className="mt-1.5 list-disc space-y-1 pl-4">
                  <li>Token akses disimpan sementara di memori aplikasi (RAM) dan tidak disimpan di Local Storage atau IndexedDB.</li>
                  <li>Scope dibatasi ke <code className="mono-meta text-[11px] text-primary">drive.file</code>, hanya mengakses file yang dibuat oleh aplikasi ini.</li>
                  <li>Memutuskan koneksi menghentikan sinkronisasi tanpa menghapus file di perangkat ini maupun file cadangan yang sudah ada di Drive.</li>
                </ul>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            id="pengaturan-cadangan"
            number="05"
            title="Cadangan dan pemulihan"
            description="Buat file JSON berisi seluruh proyek, jawaban, analisis, dan profil. Simpan file di tempat aman."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-[9px] border border-line bg-surface-2/40 px-3.5 py-3">
                <p className="text-[13px] font-semibold text-ink">Unduh cadangan</p>
                <p className="mt-1 text-[11px] leading-relaxed text-ink-muted">
                  File cadangan dapat dibuka kembali di perangkat lain melalui pemulihan.
                </p>
                <Button className="mt-3" size="sm" variant="primary" icon="download" onClick={backupWorkspace}>
                  Unduh file cadangan
                </Button>
              </div>
              <div className="rounded-[9px] border border-line bg-surface-2/40 px-3.5 py-3">
                <p className="text-[13px] font-semibold text-ink">Pulihkan cadangan</p>
                <p className="mt-1 text-[11px] leading-relaxed text-ink-muted">
                  Pemulihan mengganti seluruh data saat ini, bukan menggabungkannya.
                </p>
                <input
                  ref={fileInput}
                  type="file"
                  accept="application/json,.json"
                  className="sr-only"
                  aria-label="Pilih file cadangan JSON"
                  onChange={(event) => void handleRestoreFile(event.target.files?.[0])}
                />
                <Button className="mt-3" size="sm" variant="secondary" icon="upload" onClick={() => fileInput.current?.click()}>
                  Pilih file cadangan
                </Button>
              </div>
            </div>
            {restoreError ? (
              <InlineNotice tone="danger" className="mt-3" title="Cadangan tidak dapat dibaca">
                {restoreError}
              </InlineNotice>
            ) : null}
          </SectionCard>

          <SectionCard
            id="pengaturan-contoh"
            number="06"
            title="Data contoh"
            description="Muat satu proyek contoh lengkap untuk mencoba alur panduan, sesi, analisis, dan ekspor."
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-ink">
                  {demoExists ? 'Data contoh sudah pernah dimuat.' : 'Belum ada data contoh pada ruang kerja ini.'}
                </p>
                <p className="mt-1 max-w-xl text-[11px] leading-relaxed text-ink-muted">
                  Proyek contoh selalu diberi keterangan “Data contoh”. Memuat ulang akan menambah proyek baru, bukan
                  menimpa proyek yang sudah ada.
                </p>
              </div>
              <Button variant="secondary" icon="download" onClick={() => setDemoOpen(true)}>
                {demoExists ? 'Muat data contoh lagi' : 'Muat data contoh'}
              </Button>
            </div>
          </SectionCard>

          <SectionCard
            id="pengaturan-bahaya"
            number="07"
            title="Hapus seluruh data"
            description="Tindakan ini tidak dapat dibatalkan dan tidak memiliki cadangan otomatis."
            className="border-danger/30"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-ink">Kosongkan ruang kerja</p>
                <p className="mt-1 max-w-xl text-[11px] leading-relaxed text-ink-muted">
                  Semua proyek, dokumen, pertanyaan, narasumber, jawaban, kode, tema, catatan, riwayat ekspor, dan
                  profil lokal akan dihapus dari perangkat ini.
                </p>
              </div>
              <Button variant="danger" icon="trash" onClick={() => setResetOpen(true)}>
                Hapus seluruh data
              </Button>
            </div>
          </SectionCard>
        </div>

        <aside className="space-y-4 xl:sticky xl:top-20">
          <section className="rounded-[12px] border border-line bg-surface px-4 py-4" aria-labelledby="tentang-aplikasi">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-[9px] bg-primary text-primary-ink">
                <Icon name="guide" size={18} />
              </span>
              <div className="min-w-0">
                <h2 id="tentang-aplikasi" className="text-[13px] font-semibold text-ink">
                  Interview Workspace
                </h2>
                <p className="mono-meta text-ink-muted">Versi 1.0.0</p>
              </div>
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-ink-muted">
              Ruang kerja wawancara kualitatif yang berjalan sepenuhnya di browser. Tidak ada unggahan data ke server
              dan tidak ada analisis otomatis yang dibuat tanpa persetujuan Anda.
            </p>
            <dl className="mt-3 space-y-2 border-t border-line pt-3 text-[11px]">
              <div className="flex items-start justify-between gap-3">
                <dt className="text-ink-muted">Profil</dt>
                <dd className="max-w-[60%] text-right font-medium text-ink">{profile?.name ?? 'Belum diisi'}</dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-ink-muted">Email</dt>
                <dd className="max-w-[60%] truncate text-right font-medium text-ink">{profile?.email ?? 'Belum diisi'}</dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-ink-muted">Institusi</dt>
                <dd className="max-w-[60%] text-right font-medium text-ink">{profile?.institution || 'Tidak diisi'}</dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-ink-muted">Data contoh</dt>
                <dd className="font-medium text-ink">{demoExists ? 'Ada' : 'Belum dimuat'}</dd>
              </div>
            </dl>
          </section>

          <section className="rounded-[12px] border border-line bg-surface px-4 py-4" aria-labelledby="catatan-privasi">
            <h2 id="catatan-privasi" className="text-[13px] font-semibold text-ink">
              Catatan privasi
            </h2>
            <p className="mt-1.5 text-[11px] leading-relaxed text-ink-muted">
              Data wawancara dapat memuat informasi pribadi. Gunakan kode narasumber, hindari menulis data yang tidak
              diperlukan, dan unduh cadangan hanya ke perangkat yang Anda percaya.
            </p>
            <p className="mt-2 text-[11px] leading-relaxed text-ink-muted">
              Menghapus data browser atau memakai mode privat dapat menghilangkan data. Buat cadangan berkala.
            </p>
          </section>

          <section className="rounded-[12px] border border-line bg-surface-2/50 px-4 py-3.5">
            <p className="mono-meta uppercase text-ink-muted">Pintasan</p>
            <ul className="mt-1.5 space-y-1 text-[11px] leading-relaxed text-ink-muted">
              <li>Esc menutup dialog yang sedang terbuka.</li>
              <li>Tab memindahkan fokus di dalam dialog.</li>
              <li>Perubahan jawaban tersimpan otomatis setelah berhenti mengetik.</li>
            </ul>
          </section>
        </aside>
      </div>

      <Modal
        open={Boolean(restorePreview)}
        onClose={() => {
          if (!restoring) setRestorePreview(null)
        }}
        title="Pulihkan cadangan ini?"
        description="Seluruh data saat ini akan diganti dengan isi file cadangan."
        size="sm"
        preventClose={restoring}
        footer={
          <>
            <Button onClick={() => setRestorePreview(null)} disabled={restoring}>
              Batal
            </Button>
            <Button variant="danger" onClick={() => void confirmRestore()} disabled={restoring}>
              {restoring ? <Spinner size={15} /> : null}
              {restoring ? 'Memulihkan…' : 'Ganti data sekarang'}
            </Button>
          </>
        }
      >
        {restorePreview ? (
          <div className="space-y-3 text-sm">
            <div className="rounded-[9px] border border-line bg-surface-2 px-3.5 py-3">
              <p className="mono-meta uppercase text-ink-muted">Isi cadangan</p>
              <ul className="mt-1.5 space-y-1 text-[12px] text-ink-soft">
                <li>{restorePreview.projects} proyek</li>
                <li>{restorePreview.questions} pertanyaan</li>
                <li>{restorePreview.respondents} narasumber</li>
                <li>{restorePreview.sessions} sesi</li>
                <li>{restorePreview.answers} slot jawaban</li>
                {restorePreview.profileName ? <li>Profil: {restorePreview.profileName}</li> : null}
                {restorePreview.exportedAt ? <li>Dibuat: {formatDate(restorePreview.exportedAt, true)}</li> : null}
              </ul>
            </div>
            <p className="text-[12px] leading-relaxed text-ink-muted">
              Data yang ada sekarang, termasuk profil, akan dihapus dan diganti. Pastikan Anda sudah membuat cadangan
              data terbaru bila masih diperlukan.
            </p>
          </div>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={demoOpen}
        onClose={() => setDemoOpen(false)}
        onConfirm={() => void confirmDemo()}
        busy={loadingDemo}
        tone="primary"
        title="Muat data contoh?"
        description="Proyek contoh ditambahkan sebagai proyek baru dengan keterangan Data contoh."
        impact="Proyek, narasumber, jawaban, dan analisis yang sudah ada tidak diubah. Anda dapat menghapus proyek contoh kapan saja."
        confirmLabel="Muat data contoh"
      />

      <Modal
        open={resetOpen}
        onClose={() => {
          if (!resetting) {
            setResetOpen(false)
            setResetPhrase('')
          }
        }}
        title="Hapus seluruh data?"
        description="Tindakan ini permanen. Tidak ada pembatalan setelah data dihapus."
        size="sm"
        preventClose={resetting}
        footer={
          <>
            <Button
              onClick={() => {
                setResetOpen(false)
                setResetPhrase('')
              }}
              disabled={resetting}
            >
              Batal
            </Button>
            <Button
              variant="danger"
              icon="trash"
              onClick={() => void confirmReset()}
              disabled={resetting || resetPhrase.trim().toUpperCase() !== 'HAPUS'}
            >
              {resetting ? <Spinner size={15} /> : null}
              {resetting ? 'Menghapus…' : 'Hapus permanen'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <InlineNotice tone="danger" title="Dampak">
            Semua proyek, dokumen, pertanyaan, narasumber, sesi, jawaban, kode, kategori, tema, catatan analisis, dan
            riwayat ekspor di perangkat ini akan dihapus. Profil lokal juga dihapus dan Anda kembali ke halaman awal.
          </InlineNotice>
          <Field
            label='Ketik "HAPUS" untuk melanjutkan'
            htmlFor="reset-confirm"
            hint="Huruf besar atau kecil tidak dibedakan."
          >
            <Input
              id="reset-confirm"
              value={resetPhrase}
              onChange={(event) => setResetPhrase(event.target.value)}
              placeholder="HAPUS"
              autoComplete="off"
              disabled={resetting}
            />
          </Field>
          <p className="text-[11px] leading-relaxed text-ink-muted">
            Buat cadangan melalui bagian Cadangan dan pemulihan sebelum melanjutkan bila data masih dibutuhkan.
          </p>
        </div>
      </Modal>
    </>
  )
}
