import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useWorkspace } from '../lib/store'
import { PROJECT_STATUSES, type Project } from '../lib/types'
import { lastProjectActivity, projectSessions, projectStats, projectRespondents } from '../lib/selectors'
import { formatDate, relativeTime } from '../lib/utils'
import { usePageTitle } from '../lib/hooks'
import { ProjectDialog } from '../components/ProjectDialog'
import { HelpDialog } from '../components/HelpDialog'
import { Icon } from '../components/Icon'
import {
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  IconButton,
  Input,
  PageHeader,
  Progress,
  SearchInput,
  Select,
  StatusBadge,
  cx,
  useToast,
} from '../components/ui'

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="bg-surface px-4 py-4 sm:px-5">
      <p className="mono-meta uppercase text-ink-muted">{label}</p>
      <p className="mt-1 text-[22px] font-semibold leading-none tracking-[-0.02em] text-ink">{value}</p>
      {hint ? <p className="mt-1.5 text-[11px] leading-snug text-ink-muted">{hint}</p> : null}
    </div>
  )
}

function ProjectCard({
  project,
  onEdit,
  onDelete,
  onArchive,
}: {
  project: Project
  onEdit: () => void
  onDelete: () => void
  onArchive: () => void
}) {
  const { data } = useWorkspace()
  const stats = projectStats(data, project.id)
  const sessionCount = projectSessions(data, project.id).length
  const respondentCount = projectRespondents(data, project.id).length
  const archived = project.status === 'Diarsipkan'

  return (
    <article
      className={cx(
        'group flex flex-col rounded-[12px] border border-line bg-surface p-4 transition-[box-shadow,border-color] duration-200 sm:p-5',
        archived ? 'opacity-80' : 'hover:border-line-strong hover:shadow-[0_10px_30px_-22px_rgba(20,35,26,0.45)]',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <StatusBadge status={project.status} />
        <span className="mono-meta shrink-0 pt-0.5 text-ink-muted">{formatDate(project.createdAt)}</span>
      </div>

      <h3 className="mt-3 text-[16px] font-semibold leading-snug tracking-[-0.01em] text-ink">
        <Link to={`/p/${project.id}`} className="rounded transition-colors hover:text-primary">
          {project.title}
        </Link>
      </h3>
      <p className="mt-1.5 line-clamp-2 min-h-[2.6em] text-[13px] leading-relaxed text-ink-muted">
        {project.description || project.objective || 'Belum ada deskripsi. Buka proyek untuk menambahkan konteks.'}
      </p>

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <Badge tone="success" dot>
          Tersimpan di perangkat
        </Badge>
        {project.backupEnabled ? (
          <Badge
            tone={
              project.syncStatus === 'Tersinkron ke Google Drive'
                ? 'success'
                : project.syncStatus === 'Gagal menyinkronkan' || project.syncStatus === 'Konflik'
                  ? 'danger'
                  : 'warn'
            }
            dot
          >
            {project.syncStatus ?? 'Menunggu sinkronisasi'}
          </Badge>
        ) : (
          <Badge tone="neutral" dot>
            Belum dicadangkan
          </Badge>
        )}
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-line pt-3">
        <div>
          <dt className="mono-meta uppercase text-ink-muted">Narasumber</dt>
          <dd className="mt-0.5 text-sm font-semibold text-ink">{respondentCount}</dd>
        </div>
        <div>
          <dt className="mono-meta uppercase text-ink-muted">Sesi</dt>
          <dd className="mt-0.5 text-sm font-semibold text-ink">
            {sessionCount}
            {stats.completedSessions > 0 ? <span className="ml-1 text-[11px] font-normal text-ink-muted">{stats.completedSessions} selesai</span> : null}
          </dd>
        </div>
        <div>
          <dt className="mono-meta uppercase text-ink-muted">Jawaban</dt>
          <dd className="mt-0.5 text-sm font-semibold text-ink">{stats.answersFilled}</dd>
        </div>
      </dl>

      <div className="mt-4">
        <div className="mb-1.5 flex items-center justify-between text-[11px]">
          <span className="text-ink-muted">Cakupan jawaban</span>
          <span className="mono-meta text-ink-soft">{stats.coverage}%</span>
        </div>
        <Progress value={stats.coverage} label={`Cakupan jawaban ${project.title}`} tone={stats.coverage === 100 ? 'success' : 'primary'} />
      </div>

      <div className="mt-4 flex items-center justify-between gap-2 border-t border-line pt-3">
        <span className="min-w-0 truncate text-[11px] text-ink-muted">
          {project.lastOpenedAt ? `Dibuka ${relativeTime(project.lastOpenedAt)}` : `Diperbarui ${relativeTime(lastProjectActivity(data, project.id) ?? project.updatedAt)}`}
        </span>
        <div className="flex shrink-0 items-center gap-0.5">
          <IconButton label="Ubah detail proyek" icon="edit" size="sm" onClick={onEdit} />
          <IconButton
            label={archived ? 'Keluarkan dari arsip' : 'Arsipkan proyek'}
            icon="archive"
            size="sm"
            onClick={onArchive}
          />
          <IconButton label="Hapus proyek" icon="trash" size="sm" danger onClick={onDelete} />
          <Link
            to={`/p/${project.id}`}
            className="ml-1 inline-flex h-9 items-center gap-1.5 rounded-[8px] border border-line-strong bg-surface px-2.5 text-[13px] font-medium text-ink transition-colors hover:bg-surface-2 max-sm:h-11"
          >
            Buka
            <Icon name="arrowRight" size={14} />
          </Link>
        </div>
      </div>
    </article>
  )
}

export function Dashboard() {
  usePageTitle('Dasbor')
  const { data, profile, loadDemo, updateProject, deleteProject } = useWorkspace()
  const { notify } = useToast()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('Semua')
  const [month, setMonth] = useState('')
  const [sort, setSort] = useState('terakhir')
  const [showArchived, setShowArchived] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<Project | null>(null)
  const [deleting, setDeleting] = useState<Project | null>(null)
  const [helpOpen, setHelpOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const totals = useMemo(() => {
    const activeProjects = data.projects.filter((project) => project.status !== 'Diarsipkan')
    const projectIds = new Set(activeProjects.map((project) => project.id))
    return {
      projects: activeProjects.length,
      respondents: data.respondents.filter((respondent) => projectIds.has(respondent.projectId) && !respondent.archivedAt).length,
      sessions: data.sessions.filter((session) => projectIds.has(session.projectId) && session.status !== 'Diarsipkan').length,
      answers: data.answers.filter((answer) => projectIds.has(answer.projectId) && answer.text.trim().length > 0).length,
    }
  }, [data])

  const lastOpened = useMemo(() => {
    return [...data.projects]
      .filter((project) => project.lastOpenedAt && project.status !== 'Diarsipkan')
      .sort((a, b) => new Date(b.lastOpenedAt ?? 0).getTime() - new Date(a.lastOpenedAt ?? 0).getTime())[0]
  }, [data.projects])

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const hideArchived = !showArchived && status !== 'Diarsipkan'
    const list = data.projects.filter((project) => {
      if (hideArchived && project.status === 'Diarsipkan') return false
      if (status !== 'Semua' && project.status !== status) return false
      if (month && project.createdAt.slice(0, 7) !== month) return false
      if (!needle) return true
      return [project.title, project.description, project.objective].some((value) => value.toLowerCase().includes(needle))
    })
    return list.sort((a, b) => {
      if (sort === 'nama') return a.title.localeCompare(b.title, 'id')
      if (sort === 'dibuat') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      return new Date(b.lastOpenedAt ?? b.updatedAt).getTime() - new Date(a.lastOpenedAt ?? a.updatedAt).getTime()
    })
  }, [data.projects, query, status, month, sort, showArchived])

  const hasFilter = query.trim() !== '' || status !== 'Semua' || month !== '' || showArchived

  const handleDemo = async () => {
    setBusy(true)
    try {
      const id = await loadDemo()
      notify('Proyek contoh dimuat. Data ini ditandai sebagai data contoh.')
      if (id) navigate(`/p/${id}`)
    } finally {
      setBusy(false)
    }
  }

  const handleArchive = async (project: Project) => {
    const archived = project.status === 'Diarsipkan'
    await updateProject(project.id, { status: archived ? 'Persiapan' : 'Diarsipkan' })
    notify(archived ? 'Proyek dikeluarkan dari arsip.' : 'Proyek diarsipkan. Data tetap tersimpan.')
  }

  const confirmDelete = async () => {
    if (!deleting) return
    setBusy(true)
    try {
      await deleteProject(deleting.id)
      notify('Proyek dan seluruh data terkait dihapus.')
      setDeleting(null)
    } finally {
      setBusy(false)
    }
  }

  const deletingSessions = deleting ? data.sessions.filter((session) => session.projectId === deleting.id).length : 0
  const deletingRespondents = deleting ? data.respondents.filter((respondent) => respondent.projectId === deleting.id).length : 0
  const deletingAnswers = deleting ? data.answers.filter((answer) => answer.projectId === deleting.id).length : 0

  return (
    <>
      <PageHeader
        title="Dasbor"
        description={
          profile?.name
            ? `Ruang kerja ${profile.name}. Kelola proyek wawancara, panduan, dan data jawaban dari satu tempat.`
            : 'Kelola proyek wawancara, panduan pertanyaan, dan data jawaban dari satu tempat.'
        }
        actions={
          <>
            <Button variant="secondary" icon="download" onClick={() => void handleDemo()} disabled={busy}>
              {busy ? 'Memuat…' : 'Muat data contoh'}
            </Button>
            <Button variant="primary" icon="plus" onClick={() => setCreateOpen(true)}>
              Proyek baru
            </Button>
          </>
        }
      />

      <section aria-label="Ringkasan ruang kerja" className="overflow-hidden rounded-[12px] border border-line">
        <div className="grid grid-cols-2 gap-px bg-line sm:grid-cols-4">
          <Metric label="Proyek aktif" value={String(totals.projects)} hint={`${data.projects.length} total termasuk arsip`} />
          <Metric label="Narasumber" value={String(totals.respondents)} hint="Pada proyek aktif" />
          <Metric label="Sesi" value={String(totals.sessions)} hint="Tidak termasuk arsip" />
          <Metric label="Jawaban terisi" value={String(totals.answers)} hint="Seluruh proyek aktif" />
        </div>
      </section>

      {lastOpened ? (
        <section className="mt-5 flex flex-col gap-3 rounded-[12px] border border-primary/20 bg-primary-soft/50 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="flex min-w-0 items-start gap-3">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface text-primary">
              <Icon name="clock" size={16} />
            </span>
            <div className="min-w-0">
              <p className="mono-meta uppercase text-primary/80">Terakhir dibuka</p>
              <p className="truncate text-sm font-semibold text-ink">{lastOpened.title}</p>
              <p className="text-[11px] text-ink-muted">{relativeTime(lastOpened.lastOpenedAt)}</p>
            </div>
          </div>
          <Link
            to={`/p/${lastOpened.id}`}
            className="inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-[8px] bg-primary px-3 text-[13px] font-medium text-primary-ink max-sm:h-11"
          >
            Lanjutkan
            <Icon name="arrowRight" size={14} />
          </Link>
        </section>
      ) : null}

      <section className="mt-8" aria-labelledby="daftar-proyek">
        <div className="flex flex-col gap-3 border-b border-line pb-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 id="daftar-proyek" className="text-[15px] font-semibold text-ink">
              Proyek wawancara
            </h2>
            <p className="mt-0.5 text-xs text-ink-muted">
              {filtered.length} proyek ditampilkan{hasFilter ? ' sesuai filter' : ''}.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
            <SearchInput value={query} onChange={setQuery} placeholder="Cari proyek…" className="col-span-2 sm:w-52" />
            <Select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filter status proyek" className="text-[13px] sm:w-auto">
              <option value="Semua">Semua status</option>
              {PROJECT_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </Select>
            <Select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Urutkan proyek" className="text-[13px] sm:w-auto">
              <option value="terakhir">Terakhir aktif</option>
              <option value="dibuat">Terbaru dibuat</option>
              <option value="nama">Nama A-Z</option>
            </Select>
            <div className="col-span-2 flex items-center gap-2 sm:col-span-1">
              <Input
                type="month"
                value={month}
                onChange={(event) => setMonth(event.target.value)}
                aria-label="Filter bulan dibuat"
                className="h-10 text-[13px] sm:w-40"
              />
              {month ? (
                <Button size="sm" variant="ghost" onClick={() => setMonth('')}>
                  Hapus bulan
                </Button>
              ) : null}
            </div>
            {status === 'Semua' ? (
              <label className="col-span-2 flex items-center gap-2 text-xs text-ink-soft sm:col-span-1 sm:pl-1">
                <input
                  type="checkbox"
                  checked={showArchived}
                  onChange={(event) => setShowArchived(event.target.checked)}
                  className="h-4 w-4 rounded border-line-strong accent-[var(--primary)]"
                />
                Tampilkan arsip
              </label>
            ) : null}
          </div>
        </div>

        {data.projects.length === 0 ? (
          <div className="mt-6">
            <EmptyState
              icon="folder"
              title="Belum ada proyek wawancara"
              description="Mulai dengan membuat proyek, lalu susun panduan dan catat sesi wawancara. Semua data tersimpan di perangkat ini."
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  <Button variant="primary" icon="plus" onClick={() => setCreateOpen(true)}>
                    Buat proyek pertama
                  </Button>
                  <Button variant="secondary" icon="download" onClick={() => void handleDemo()} disabled={busy}>
                    Lihat dengan data contoh
                  </Button>
                </div>
              }
            />
            <div className="mx-auto mt-6 grid max-w-2xl gap-3 sm:grid-cols-3">
              {[
                { code: '01', title: 'Susun panduan', detail: 'Impor dokumen atau tulis pertanyaan, lalu atur urutannya.' },
                { code: '02', title: 'Catat sesi', detail: 'Buat sesi per narasumber. Jawaban tersimpan otomatis.' },
                { code: '03', title: 'Analisis dan ekspor', detail: 'Beri kode, bentuk tema, lalu ekspor hasil sesuai kebutuhan.' },
              ].map((step) => (
                <div key={step.code} className="rounded-[10px] border border-line bg-surface/70 px-4 py-3">
                  <span className="mono-meta text-accent">{step.code}</span>
                  <p className="mt-1 text-[13px] font-semibold text-ink">{step.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-ink-muted">{step.detail}</p>
                </div>
              ))}
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            className="mt-6"
            icon="search"
            title="Tidak ada proyek yang cocok"
            description="Ubah kata kunci, status, atau bulan pembuatan untuk menemukan proyek lain."
            action={
              <Button
                variant="secondary"
                onClick={() => {
                  setQuery('')
                  setStatus('Semua')
                  setMonth('')
                  setShowArchived(false)
                }}
              >
                Reset filter
              </Button>
            }
          />
        ) : (
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {filtered.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onEdit={() => setEditing(project)}
                onDelete={() => setDeleting(project)}
                onArchive={() => void handleArchive(project)}
              />
            ))}
          </div>
        )}
      </section>

      {data.projects.length > 0 ? (
        <section className="mt-8 flex flex-col gap-3 rounded-[12px] border border-dashed border-line-strong px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div>
            <p className="text-[13px] font-semibold text-ink">Ingin mencoba alur lengkap?</p>
            <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">
              Muat proyek contoh berisi panduan, tiga narasumber, jawaban, coding, dan tema. Ditandai jelas sebagai data contoh.
            </p>
          </div>
          <Button variant="secondary" icon="download" onClick={() => void handleDemo()} disabled={busy} className="shrink-0">
            {busy ? 'Memuat…' : 'Muat data contoh'}
          </Button>
        </section>
      ) : null}

      <section
        className="mt-8 rounded-[12px] border border-line bg-surface p-4 sm:p-5"
        aria-labelledby="dashboard-dev-contact"
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
              <Icon name="help" size={20} />
            </span>
            <div className="min-w-0">
              <h2 id="dashboard-dev-contact" className="text-[14px] font-semibold text-ink">
                Bantuan & Kontak Pengembang
              </h2>
              <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">
                Memiliki pertanyaan, kendala, atau saran pengembangan? Hubungi langsung pengembang aplikasi.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <a
              href="mailto:nndarz03@gmail.com"
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-line bg-surface-2/60 px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-surface-2 hover:text-primary"
            >
              <Icon name="mail" size={14} className="text-primary" />
              <span>nndarz03@gmail.com</span>
            </a>
            <a
              href="https://wa.me/6285601689713"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-line bg-surface-2/60 px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-surface-2 hover:text-success"
            >
              <Icon name="phone" size={14} className="text-success" />
              <span>085601689713</span>
            </a>
            <a
              href="https://github.com/naandarz"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-line bg-surface-2/60 px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-surface-2"
            >
              <Icon name="github" size={14} />
              <span>GitHub @naandarz</span>
              <Icon name="external" size={12} className="text-ink-muted" />
            </a>
            <Button variant="secondary" size="sm" onClick={() => setHelpOpen(true)}>
              Panduan Lengkap
            </Button>
          </div>
        </div>
      </section>

      <ProjectDialog open={createOpen} onClose={() => setCreateOpen(false)} onCreated={(project) => navigate(`/p/${project.id}`)} />
      <ProjectDialog open={Boolean(editing)} onClose={() => setEditing(null)} project={editing ?? undefined} />
      <HelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} />

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={() => void confirmDelete()}
        busy={busy}
        title={deleting ? `Hapus “${deleting.title}”?` : 'Hapus proyek?'}
        description="Tindakan ini tidak dapat dibatalkan."
        impact={
          deleting
            ? `${deletingRespondents} narasumber, ${deletingSessions} sesi, dan ${deletingAnswers} jawaban beserta seluruh coding, kategori, tema, memo, dan riwayat ekspor pada proyek ini akan dihapus permanen.`
            : ''
        }
        confirmLabel="Hapus proyek"
      />
    </>
  )
}
