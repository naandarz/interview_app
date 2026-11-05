import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useProject, usePageTitle } from '../lib/hooks'
import { useWorkspace } from '../lib/store'
import { PROJECT_STATUSES, type Project } from '../lib/types'
import {
  projectAnswers,
  projectQuestions,
  projectRespondents,
  projectSessions,
  projectStats,
  qualityIssues,
  sessionProgress,
} from '../lib/selectors'
import { formatDate, relativeTime } from '../lib/utils'
import { ProjectDialog } from '../components/ProjectDialog'
import { Icon, type IconName } from '../components/Icon'
import {
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  InlineNotice,
  PageHeader,
  Progress,
  Select,
  StatusBadge,
  cx,
  useToast,
} from '../components/ui'

function StatCard({ label, value, detail, icon }: { label: string; value: string; detail: string; icon: IconName }) {
  return (
    <div className="rounded-[10px] border border-line bg-surface px-4 py-3.5">
      <div className="flex items-start justify-between gap-2">
        <p className="mono-meta uppercase text-ink-muted">{label}</p>
        <Icon name={icon} size={15} className="text-ink-muted" />
      </div>
      <p className="mt-1.5 text-[22px] font-semibold leading-none tracking-[-0.02em] text-ink">{value}</p>
      <p className="mt-1 text-[11px] leading-snug text-ink-muted">{detail}</p>
    </div>
  )
}

function ChecklistRow({
  index,
  title,
  detail,
  done,
  to,
  actionLabel,
}: {
  index: number
  title: string
  detail: string
  done: boolean
  to: string
  actionLabel: string
}) {
  return (
    <li className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
      <span
        className={cx(
          'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold',
          done ? 'border-success/30 bg-success-soft text-success' : 'border-line-strong bg-surface-2 text-ink-muted',
        )}
        aria-hidden="true"
      >
        {done ? <Icon name="check" size={13} /> : String(index).padStart(2, '0')}
      </span>
      <div className="min-w-0 flex-1">
        <p className={cx('text-[13px] font-semibold', done ? 'text-ink-muted' : 'text-ink')}>{title}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">{detail}</p>
      </div>
      {done ? (
        <Badge tone="success" className="mt-0.5 shrink-0">
          Selesai
        </Badge>
      ) : (
        <Link to={to} className="mt-0.5 inline-flex min-h-8 shrink-0 items-center gap-1 rounded px-1 text-xs font-medium text-primary hover:underline">
          {actionLabel}
          <Icon name="chevronRight" size={12} />
        </Link>
      )}
    </li>
  )
}

export function ProjectOverview() {
  const project = useProject()
  const {
    data,
    updateProject,
    setProjectStatus,
    deleteProject,
    createSession,
  } = useWorkspace()
  const { notify } = useToast()
  const navigate = useNavigate()
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  usePageTitle(project?.title ?? 'Ikhtisar proyek')

  const summary = useMemo(() => {
    if (!project) return null
    const stats = projectStats(data, project.id)
    const questions = projectQuestions(data, project.id)
    const respondents = projectRespondents(data, project.id)
    const sessions = projectSessions(data, project.id)
    const answers = projectAnswers(data, project.id)
    const issues = qualityIssues(data, project)
    const exports = data.exports.filter((record) => record.projectId === project.id)
    const codes = data.codes.filter((code) => code.projectId === project.id)
    const themes = data.themes.filter((theme) => theme.projectId === project.id)
    return { stats, questions, respondents, sessions, answers, issues, exports, codes, themes }
  }, [data, project])

  if (!project || !summary) {
    return (
      <EmptyState
        icon="folder"
        title="Proyek tidak ditemukan"
        description="Kembali ke dasbor untuk memilih proyek lain."
        action={
          <Link to="/">
            <Button variant="primary">Kembali ke dasbor</Button>
          </Link>
        }
      />
    )
  }

  const { stats, questions, respondents, sessions, answers, issues, exports, codes, themes } = summary
  const latestSession = sessions[0]

  const checklist = [
    {
      title: 'Lengkapi detail proyek',
      detail: 'Isi deskripsi dan tujuan agar konteks wawancara jelas saat dibuka kembali.',
      done: Boolean(project.description.trim() && project.objective.trim()),
      to: `/p/${project.id}`,
      action: 'Ubah detail',
    },
    {
      title: 'Susun panduan pertanyaan',
      detail: questions.length > 0 ? `${stats.activeQuestions} pertanyaan aktif pada ${new Set(questions.map((q) => q.sectionId)).size} bagian.` : 'Impor dokumen atau tulis pertanyaan pertama.',
      done: stats.activeQuestions > 0,
      to: `/p/${project.id}/panduan`,
      action: 'Buka panduan',
    },
    {
      title: 'Tambah narasumber',
      detail: respondents.length > 0 ? `${respondents.length} narasumber aktif terdaftar.` : 'Gunakan kode seperti R01 bila nama tidak perlu dicatat.',
      done: respondents.length > 0,
      to: `/p/${project.id}/narasumber`,
      action: 'Tambah',
    },
    {
      title: 'Buat sesi wawancara',
      detail: sessions.length > 0 ? `${sessions.length} sesi tercatat.` : 'Satu sesi mewakili satu wawancara dengan satu narasumber.',
      done: sessions.length > 0,
      to: `/p/${project.id}/sesi?baru=1`,
      action: 'Buat sesi',
    },
    {
      title: 'Selesaikan minimal satu sesi',
      detail: stats.completedSessions > 0 ? `${stats.completedSessions} sesi ditandai selesai.` : 'Tandai sesi selesai setelah jawaban ditinjau.',
      done: stats.completedSessions > 0,
      to: latestSession ? `/p/${project.id}/sesi/${latestSession.id}` : `/p/${project.id}/sesi`,
      action: 'Buka sesi',
    },
    {
      title: 'Ekspor hasil',
      detail: exports.length > 0 ? `${exports.length} ekspor pernah dibuat.` : 'Panduan, data mentah, dan laporan dapat diunduh kapan saja.',
      done: exports.length > 0,
      to: `/p/${project.id}/ekspor`,
      action: 'Ekspor',
    },
  ]
  const completedSteps = checklist.filter((step) => step.done).length

  const handleStatus = async (status: Project['status']) => {
    await setProjectStatus(project.id, status)
    notify(`Status proyek diubah menjadi ${status}.`)
  }

  const handleArchive = async () => {
    const archived = project.status === 'Diarsipkan'
    await updateProject(project.id, { status: archived ? 'Persiapan' : 'Diarsipkan' })
    notify(archived ? 'Proyek diaktifkan kembali.' : 'Proyek diarsipkan. Data tetap tersimpan.')
  }

  const confirmDelete = async () => {
    setBusy(true)
    try {
      await deleteProject(project.id)
      notify('Proyek dan seluruh data terkait dihapus.')
      navigate('/')
    } finally {
      setBusy(false)
    }
  }

  const startSession = async () => {
    if (!respondents.length) {
      navigate(`/p/${project.id}/narasumber`)
      notify('Tambahkan narasumber sebelum membuat sesi.', 'info')
      return
    }
    if (latestSession && latestSession.status !== 'Selesai') {
      navigate(`/p/${project.id}/sesi/${latestSession.id}`)
      return
    }
    const created = await createSession({
      projectId: project.id,
      respondentId: respondents[0].id,
      title: `Wawancara ${respondents[0].code}`,
      interviewDate: new Date().toISOString(),
      method: 'Tatap muka',
      interviewerName: '',
      durationMinutes: null,
      notes: '',
    })
    if (created) navigate(`/p/${project.id}/sesi/${created.id}`)
  }

  return (
    <>
      <PageHeader
        breadcrumb={
          <>
            <Link to="/" className="hover:text-ink">
              Dasbor
            </Link>
            <Icon name="chevronRight" size={12} />
            <span>Proyek</span>
          </>
        }
        title={project.title}
        description={project.description || 'Belum ada deskripsi proyek.'}
        meta={
          <>
            <StatusBadge status={project.status} />
            <span className="mono-meta">Dibuat {formatDate(project.createdAt)}</span>
            <span className="text-line-strong">·</span>
            <span className="mono-meta">Diperbarui {relativeTime(project.updatedAt)}</span>
          </>
        }
        actions={
          <>
            <Button variant="secondary" icon="edit" onClick={() => setEditOpen(true)}>
              Ubah detail
            </Button>
            <Button variant="secondary" icon="export" onClick={() => navigate(`/p/${project.id}/ekspor`)}>
              Ekspor
            </Button>
            <Button variant="primary" icon={sessions.length ? 'arrowRight' : 'plus'} onClick={() => void startSession()}>
              {sessions.length ? 'Lanjutkan sesi' : 'Mulai sesi'}
            </Button>
          </>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <div className="min-w-0 space-y-5">
          <section aria-label="Statistik proyek" className="grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4">
            <StatCard label="Narasumber" value={String(respondents.length)} detail={`${sessions.length} sesi tercatat`} icon="people" />
            <StatCard label="Pertanyaan" value={String(stats.activeQuestions)} detail={`${questions.length - stats.activeQuestions} nonaktif`} icon="guide" />
            <StatCard label="Jawaban" value={`${stats.answersFilled}/${stats.answersTotal}`} detail="Jawaban terisi dari total slot" icon="data" />
            <StatCard label="Cakupan" value={`${stats.coverage}%`} detail={`${stats.codes} kode, ${stats.themes} tema`} icon="target" />
          </section>

          <section className="rounded-[12px] border border-line bg-surface px-4 py-4 sm:px-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-[15px] font-semibold text-ink">Alur kerja proyek</h2>
                <p className="mt-0.5 text-xs text-ink-muted">Enam langkah dari persiapan sampai ekspor.</p>
              </div>
              <Badge tone={completedSteps === checklist.length ? 'success' : 'neutral'}>
                {completedSteps}/{checklist.length} selesai
              </Badge>
            </div>
            <div className="mt-3">
              <Progress value={(completedSteps / checklist.length) * 100} label="Progres alur kerja" tone={completedSteps === checklist.length ? 'success' : 'primary'} />
            </div>
            <ul className="mt-2 divide-y divide-line">
              {checklist.map((step, index) => (
                <ChecklistRow
                  key={step.title}
                  index={index + 1}
                  title={step.title}
                  detail={step.detail}
                  done={step.done}
                  to={step.to}
                  actionLabel={step.action}
                />
              ))}
            </ul>
          </section>

          <section className="rounded-[12px] border border-line bg-surface px-4 py-4 sm:px-5" aria-labelledby="sesi-terbaru">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 id="sesi-terbaru" className="text-[15px] font-semibold text-ink">
                  Sesi terbaru
                </h2>
                <p className="mt-0.5 text-xs text-ink-muted">Buka sesi untuk melanjutkan pencatatan jawaban.</p>
              </div>
              <Link to={`/p/${project.id}/sesi`} className="inline-flex min-h-8 items-center gap-1 rounded text-xs font-medium text-primary hover:underline">
                Semua sesi
                <Icon name="chevronRight" size={12} />
              </Link>
            </div>
            {sessions.length === 0 ? (
              <div className="mt-3 rounded-[10px] border border-dashed border-line-strong px-4 py-6 text-center">
                <p className="text-[13px] font-medium text-ink">Belum ada sesi wawancara</p>
                <p className="mt-1 text-xs text-ink-muted">Tambahkan narasumber lalu buat sesi pertama.</p>
                <Link to={`/p/${project.id}/sesi?baru=1`} className="mt-3 inline-block">
                  <Button size="sm" variant="primary" icon="plus">
                    Buat sesi
                  </Button>
                </Link>
              </div>
            ) : (
              <ul className="mt-2 divide-y divide-line">
                {sessions.slice(0, 4).map((session) => {
                  const respondent = data.respondents.find((item) => item.id === session.respondentId)
                  const progress = sessionProgress(data, session)
                  return (
                    <li key={session.id}>
                      <Link
                        to={`/p/${project.id}/sesi/${session.id}`}
                        className="group flex flex-col gap-2 rounded-md py-3 transition-colors hover:bg-surface-2/50 sm:flex-row sm:items-center sm:gap-4 sm:px-1"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-semibold text-ink group-hover:text-primary">{session.title}</p>
                          <p className="mt-0.5 text-[11px] text-ink-muted">
                            {respondent ? `${respondent.code}${respondent.displayName ? ` · ${respondent.displayName}` : ''}` : 'Narasumber tidak ditemukan'} ·{' '}
                            {formatDate(session.interviewDate)} · {session.method}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 sm:w-48">
                          <Progress value={progress.percent} className="flex-1" label={`Progres ${session.title}`} tone={progress.percent === 100 ? 'success' : 'primary'} />
                          <span className="mono-meta w-16 shrink-0 text-right text-ink-muted">
                            {progress.answered}/{progress.total}
                          </span>
                        </div>
                        <StatusBadge status={session.status} className="self-start sm:self-auto" />
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          <section className="rounded-[12px] border border-line bg-surface px-4 py-4 sm:px-5" aria-labelledby="pemeriksaan-data">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 id="pemeriksaan-data" className="text-[15px] font-semibold text-ink">
                  Pemeriksaan data
                </h2>
                <p className="mt-0.5 text-xs text-ink-muted">Deteksi otomatis masalah kelengkapan dan keterhubungan data.</p>
              </div>
              <Badge tone={issues.length === 0 ? 'success' : issues.some((issue) => issue.severity === 'penting') ? 'danger' : 'warn'}>
                {issues.length === 0 ? 'Bersih' : `${issues.length} temuan`}
              </Badge>
            </div>
            {issues.length === 0 ? (
              <InlineNotice tone="success" className="mt-3">
                Pemeriksaan otomatis tidak menemukan masalah pada data saat ini. Ini bukan penilaian kualitas penelitian,
                hanya pemeriksaan kelengkapan teknis.
              </InlineNotice>
            ) : (
              <ul className="mt-3 space-y-2">
                {issues.slice(0, 6).map((issue) => (
                  <li key={issue.id} className="flex flex-col gap-2 rounded-[9px] border border-line bg-surface-2/40 px-3 py-2.5 sm:flex-row sm:items-start">
                    <Badge tone={issue.severity === 'penting' ? 'danger' : 'warn'} className="self-start">
                      {issue.severity === 'penting' ? 'Penting' : 'Perhatian'}
                    </Badge>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium text-ink">{issue.label}</p>
                      <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">{issue.detail}</p>
                    </div>
                    {issue.link ? (
                      <Link to={issue.link} className="inline-flex min-h-8 shrink-0 items-center gap-1 self-start rounded px-1 text-xs font-medium text-primary hover:underline">
                        Tinjau
                        <Icon name="chevronRight" size={12} />
                      </Link>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
            {issues.length > 6 ? <p className="mt-2 text-xs text-ink-muted">Dan {issues.length - 6} temuan lainnya.</p> : null}
          </section>

          <section className="rounded-[12px] border border-line bg-surface px-4 py-4 sm:px-5" aria-labelledby="detail-proyek">
            <h2 id="detail-proyek" className="text-[15px] font-semibold text-ink">
              Detail proyek
            </h2>
            <dl className="mt-3 grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="mono-meta uppercase text-ink-muted">Tujuan</dt>
                <dd className="mt-1 text-[13px] leading-relaxed text-ink-soft">{project.objective || 'Belum diisi.'}</dd>
              </div>
              <div>
                <dt className="mono-meta uppercase text-ink-muted">Deskripsi</dt>
                <dd className="mt-1 text-[13px] leading-relaxed text-ink-soft">{project.description || 'Belum diisi.'}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="mono-meta uppercase text-ink-muted">Catatan umum</dt>
                <dd className="mt-1 whitespace-pre-line text-[13px] leading-relaxed text-ink-soft">{project.generalNotes || 'Belum ada catatan.'}</dd>
              </div>
            </dl>
          </section>

          <section className="rounded-[12px] border border-danger/25 bg-surface px-4 py-4 sm:px-5" aria-labelledby="zona-bahaya">
            <h2 id="zona-bahaya" className="text-[15px] font-semibold text-ink">
              Hapus proyek
            </h2>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-ink-muted">
              Menghapus proyek akan menghapus seluruh pertanyaan, narasumber, sesi, jawaban, coding, tema, memo, dan
              riwayat ekspor di dalamnya. Pertimbangkan mengarsipkan proyek jika hanya ingin menyembunyikannya dari daftar aktif.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="secondary" icon="archive" onClick={() => void handleArchive()}>
                {project.status === 'Diarsipkan' ? 'Aktifkan kembali' : 'Arsipkan proyek'}
              </Button>
              <Button variant="danger" icon="trash" onClick={() => setDeleteOpen(true)}>
                Hapus proyek
              </Button>
            </div>
          </section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20">
          <section className="rounded-[12px] border border-line bg-surface px-4 py-4">
            <h2 className="text-[13px] font-semibold text-ink">Status proyek</h2>
            <p className="mt-0.5 text-[11px] leading-relaxed text-ink-muted">Status membantu memfilter proyek di dasbor.</p>
            <Select
              value={project.status}
              onChange={(event) => void handleStatus(event.target.value as Project['status'])}
              aria-label="Status proyek"
              className="mt-2.5"
            >
              {PROJECT_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </Select>
          </section>

          <section className="rounded-[12px] border border-line bg-surface px-4 py-4">
            <h2 className="text-[13px] font-semibold text-ink">Langkah cepat</h2>
            <div className="mt-2.5 flex flex-col gap-1.5">
              <Link to={`/p/${project.id}/data`} className="flex min-h-9 items-center justify-between gap-2 rounded-md px-2 text-[13px] text-ink-soft transition-colors hover:bg-surface-2 hover:text-ink">
                <span className="flex items-center gap-2">
                  <Icon name="data" size={15} className="text-ink-muted" />
                  Lihat semua jawaban
                </span>
                <Icon name="chevronRight" size={13} className="text-ink-muted" />
              </Link>
              <Link to={`/p/${project.id}/analisis`} className="flex min-h-9 items-center justify-between gap-2 rounded-md px-2 text-[13px] text-ink-soft transition-colors hover:bg-surface-2 hover:text-ink">
                <span className="flex items-center gap-2">
                  <Icon name="analysis" size={15} className="text-ink-muted" />
                  Coding dan tema
                </span>
                <Icon name="chevronRight" size={13} className="text-ink-muted" />
              </Link>
              <Link to={`/p/${project.id}/ekspor`} className="flex min-h-9 items-center justify-between gap-2 rounded-md px-2 text-[13px] text-ink-soft transition-colors hover:bg-surface-2 hover:text-ink">
                <span className="flex items-center gap-2">
                  <Icon name="export" size={15} className="text-ink-muted" />
                  Unduh hasil
                </span>
                <Icon name="chevronRight" size={13} className="text-ink-muted" />
              </Link>
            </div>
          </section>

          <section className="rounded-[12px] border border-line bg-surface px-4 py-4">
            <h2 className="text-[13px] font-semibold text-ink">Ringkasan data</h2>
            <dl className="mt-2.5 space-y-2 text-[12px]">
              <div className="flex items-center justify-between gap-2">
                <dt className="text-ink-muted">Dokumen sumber</dt>
                <dd className="font-medium text-ink">{data.documents.filter((doc) => doc.projectId === project.id).length}</dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-ink-muted">Jawaban kosong</dt>
                <dd className="font-medium text-ink">{answers.filter((answer) => answer.text.trim().length === 0).length}</dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-ink-muted">Kode</dt>
                <dd className="font-medium text-ink">{codes.length}</dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-ink-muted">Tema</dt>
                <dd className="font-medium text-ink">{themes.length}</dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-ink-muted">Ekspor</dt>
                <dd className="font-medium text-ink">{exports.length}</dd>
              </div>
            </dl>
          </section>

          <section className="rounded-[12px] border border-line bg-surface-2/50 px-4 py-3.5">
            <p className="mono-meta uppercase text-ink-muted">Penyimpanan lokal</p>
            <p className="mt-1 text-[11px] leading-relaxed text-ink-muted">
              Data proyek disimpan di IndexedDB pada browser ini. Buat cadangan dari Pengaturan sebelum mengganti perangkat.
            </p>
          </section>
        </aside>
      </div>

      <ProjectDialog open={editOpen} onClose={() => setEditOpen(false)} project={project} />

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => void confirmDelete()}
        busy={busy}
        title={`Hapus “${project.title}”?`}
        description="Tindakan ini tidak dapat dibatalkan."
        impact={`${respondents.length} narasumber, ${sessions.length} sesi, dan ${answers.length} jawaban beserta seluruh coding, kategori, tema, memo, dan riwayat ekspor akan dihapus permanen.`}
        confirmLabel="Hapus proyek"
      />
    </>
  )
}
