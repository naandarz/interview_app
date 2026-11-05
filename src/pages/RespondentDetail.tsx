import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { usePageTitle, useProject } from '../lib/hooks'
import { useWorkspace } from '../lib/store'
import { respondentAnswerCount, respondentSessions, sessionProgress } from '../lib/selectors'
import { formatDate, relativeTime } from '../lib/utils'
import { RespondentDialog } from '../components/RespondentDialog'
import { Icon } from '../components/Icon'
import {
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  InlineNotice,
  PageHeader,
  Progress,
  StatusBadge,
  cx,
  useToast,
} from '../components/ui'

export function RespondentDetail() {
  const project = useProject()
  const { respondentId } = useParams<{ respondentId: string }>()
  const { data, archiveRespondent, deleteRespondent } = useWorkspace()
  const { notify } = useToast()
  const navigate = useNavigate()

  const [editOpen, setEditOpen] = useState(false)
  const [archiveOpen, setArchiveOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const respondent = data.respondents.find((item) => item.id === respondentId && item.projectId === project?.id)
  usePageTitle(respondent ? `${respondent.code} ${respondent.displayName}`.trim() : 'Narasumber')

  const sessions = useMemo(() => (respondent ? respondentSessions(data, respondent.id) : []), [data, respondent])
  const answers = respondent ? respondentAnswerCount(data, respondent.id) : 0
  const totalSlots = sessions.reduce((sum, session) => sum + session.questionIds.length, 0)

  if (!project) return null

  if (!respondent) {
    return (
      <EmptyState
        icon="people"
        title="Narasumber tidak ditemukan"
        description="Narasumber ini mungkin sudah dihapus. Kembali ke daftar untuk memilih narasumber lain."
        action={
          <Link to={`/p/${project.id}/narasumber`}>
            <Button variant="primary" icon="arrowLeft">
              Kembali ke narasumber
            </Button>
          </Link>
        }
      />
    )
  }

  const confirmArchive = async () => {
    setBusy(true)
    try {
      const willArchive = !respondent.archivedAt
      await archiveRespondent(respondent.id, willArchive)
      notify(willArchive ? 'Narasumber diarsipkan. Sesi dan jawaban tetap tersimpan.' : 'Narasumber diaktifkan kembali.')
      setArchiveOpen(false)
    } finally {
      setBusy(false)
    }
  }

  const confirmDelete = async () => {
    setBusy(true)
    try {
      await deleteRespondent(respondent.id)
      notify('Narasumber dan seluruh sesinya dihapus.')
      navigate(`/p/${project.id}/narasumber`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader
        breadcrumb={
          <>
            <Link to={`/p/${project.id}/narasumber`} className="hover:text-ink">
              Narasumber
            </Link>
            <Icon name="chevronRight" size={12} />
            <span>{respondent.code}</span>
          </>
        }
        title={respondent.displayName || `Narasumber ${respondent.code}`}
        description={respondent.profileNotes || 'Belum ada catatan profil untuk narasumber ini.'}
        meta={
          <>
            <Badge tone="primary">{respondent.code}</Badge>
            {respondent.archivedAt ? <Badge tone="neutral">Diarsipkan</Badge> : <Badge tone="success">Aktif</Badge>}
            <span className="mono-meta">Ditambahkan {formatDate(respondent.createdAt)}</span>
            <span className="text-ink-muted">Diperbarui {relativeTime(respondent.updatedAt)}</span>
          </>
        }
        actions={
          <>
            <Button variant="secondary" icon="edit" onClick={() => setEditOpen(true)}>
              Ubah
            </Button>
            <Button variant="secondary" icon="archive" onClick={() => setArchiveOpen(true)}>
              {respondent.archivedAt ? 'Aktifkan' : 'Arsipkan'}
            </Button>
            <Button
              variant="primary"
              icon="plus"
              onClick={() => navigate(`/p/${project.id}/sesi?baru=1&narasumber=${respondent.id}`)}
              disabled={Boolean(respondent.archivedAt)}
            >
              Buat sesi
            </Button>
          </>
        }
      />

      {respondent.archivedAt ? (
        <InlineNotice tone="warn" className="mb-5" title="Narasumber diarsipkan">
          Sesi dan jawaban tetap dapat dibuka. Aktifkan kembali narasumber bila ingin membuat sesi baru.
        </InlineNotice>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_310px] lg:items-start">
        <div className="min-w-0 space-y-5">
          <section className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <div className="rounded-[10px] border border-line bg-surface px-4 py-3.5">
              <p className="mono-meta uppercase text-ink-muted">Sesi</p>
              <p className="mt-1 text-[22px] font-semibold text-ink">{sessions.length}</p>
              <p className="mt-0.5 text-[11px] text-ink-muted">{sessions.filter((session) => session.status === 'Selesai').length} selesai</p>
            </div>
            <div className="rounded-[10px] border border-line bg-surface px-4 py-3.5">
              <p className="mono-meta uppercase text-ink-muted">Jawaban terisi</p>
              <p className="mt-1 text-[22px] font-semibold text-ink">{answers}</p>
              <p className="mt-0.5 text-[11px] text-ink-muted">Dari {totalSlots} slot pertanyaan</p>
            </div>
            <div className="col-span-2 rounded-[10px] border border-line bg-surface px-4 py-3.5 sm:col-span-1">
              <p className="mono-meta uppercase text-ink-muted">Kelengkapan</p>
              <p className="mt-1 text-[22px] font-semibold text-ink">{totalSlots === 0 ? 0 : Math.round((answers / totalSlots) * 100)}%</p>
              <Progress value={totalSlots === 0 ? 0 : (answers / totalSlots) * 100} className="mt-2" label="Kelengkapan jawaban narasumber" />
            </div>
          </section>

          <section className="rounded-[12px] border border-line bg-surface">
            <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3.5 sm:px-5">
              <div>
                <h2 className="text-[15px] font-semibold text-ink">Riwayat sesi</h2>
                <p className="mt-0.5 text-xs text-ink-muted">Semua sesi yang terkait dengan {respondent.code}.</p>
              </div>
              <Link to={`/p/${project.id}/sesi`} className="inline-flex min-h-8 items-center gap-1 rounded px-1 text-xs font-medium text-primary hover:underline">
                Semua sesi
                <Icon name="chevronRight" size={12} />
              </Link>
            </div>

            {sessions.length === 0 ? (
              <div className="p-4 sm:p-5">
                <EmptyState
                  icon="session"
                  title="Belum ada sesi"
                  description={
                    respondent.archivedAt
                      ? 'Narasumber ini belum memiliki sesi. Aktifkan kembali untuk membuat sesi baru.'
                      : 'Buat sesi pertama untuk mulai mencatat jawaban narasumber ini.'
                  }
                  action={
                    respondent.archivedAt ? undefined : (
                      <Button
                        variant="primary"
                        icon="plus"
                        onClick={() => navigate(`/p/${project.id}/sesi?baru=1&narasumber=${respondent.id}`)}
                      >
                        Buat sesi
                      </Button>
                    )
                  }
                />
              </div>
            ) : (
              <ul className="divide-y divide-line">
                {sessions.map((session) => {
                  const progress = sessionProgress(data, session)
                  return (
                    <li key={session.id}>
                      <Link
                        to={`/p/${project.id}/sesi/${session.id}`}
                        className="group flex flex-col gap-2 px-4 py-3.5 transition-colors hover:bg-surface-2/40 sm:flex-row sm:items-center sm:gap-4 sm:px-5"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-[13px] font-semibold text-ink group-hover:text-primary">{session.title}</p>
                            <StatusBadge status={session.status} />
                          </div>
                          <p className="mt-1 text-[11px] text-ink-muted">
                            {formatDate(session.interviewDate)} · {session.method}
                            {session.interviewerName ? ` · Pewawancara: ${session.interviewerName}` : ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 sm:w-44">
                          <Progress
                            value={progress.percent}
                            className="flex-1"
                            label={`Progres ${session.title}`}
                            tone={progress.percent === 100 ? 'success' : 'primary'}
                          />
                          <span className="mono-meta w-16 shrink-0 text-right text-ink-muted">
                            {progress.answered}/{progress.total}
                          </span>
                        </div>
                        <Icon name="chevronRight" size={15} className="hidden shrink-0 text-ink-muted sm:block" />
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20">
          <section className="rounded-[12px] border border-line bg-surface px-4 py-4">
            <h2 className="text-[13px] font-semibold text-ink">Profil</h2>
            <dl className="mt-2.5 space-y-2.5 text-[12px]">
              <div>
                <dt className="mono-meta uppercase text-ink-muted">Kode</dt>
                <dd className="mt-0.5 font-mono text-[13px] font-semibold text-ink">{respondent.code}</dd>
              </div>
              <div>
                <dt className="mono-meta uppercase text-ink-muted">Nama tampilan</dt>
                <dd className="mt-0.5 text-[13px] text-ink-soft">{respondent.displayName || 'Tidak diisi'}</dd>
              </div>
              <div>
                <dt className="mono-meta uppercase text-ink-muted">Catatan profil</dt>
                <dd className="mt-0.5 whitespace-pre-line text-[13px] leading-relaxed text-ink-soft">{respondent.profileNotes || 'Belum ada catatan.'}</dd>
              </div>
            </dl>
          </section>

          <section className="rounded-[12px] border border-line bg-surface px-4 py-4">
            <h2 className="text-[13px] font-semibold text-ink">Aksi</h2>
            <div className="mt-2.5 flex flex-col gap-1.5">
              <button
                type="button"
                onClick={() => setEditOpen(true)}
                className="flex min-h-9 items-center gap-2 rounded-md px-2 text-left text-[13px] text-ink-soft transition-colors hover:bg-surface-2 hover:text-ink"
              >
                <Icon name="edit" size={15} className="text-ink-muted" />
                Ubah profil narasumber
              </button>
              <Link
                to={`/p/${project.id}/data?narasumber=${respondent.id}`}
                className="flex min-h-9 items-center gap-2 rounded-md px-2 text-[13px] text-ink-soft transition-colors hover:bg-surface-2 hover:text-ink"
              >
                <Icon name="data" size={15} className="text-ink-muted" />
                Lihat jawaban
              </Link>
              <button
                type="button"
                onClick={() => setDeleteOpen(true)}
                className="flex min-h-9 items-center gap-2 rounded-md px-2 text-left text-[13px] text-danger transition-colors hover:bg-danger-soft"
              >
                <Icon name="trash" size={15} />
                Hapus narasumber
              </button>
            </div>
          </section>

          <section className={cx('rounded-[12px] border px-4 py-3.5', respondent.archivedAt ? 'border-line bg-surface-2/50' : 'border-line bg-surface')}>
            <p className="mono-meta uppercase text-ink-muted">Status</p>
            <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">
              {respondent.archivedAt
                ? 'Diarsipkan. Data tetap tersimpan dan dapat dibuka dari daftar sesi.'
                : 'Aktif. Narasumber dapat dipilih saat membuat sesi baru.'}
            </p>
          </section>
        </aside>
      </div>

      <RespondentDialog open={editOpen} onClose={() => setEditOpen(false)} projectId={project.id} respondent={respondent} />

      <ConfirmDialog
        open={archiveOpen}
        onClose={() => setArchiveOpen(false)}
        onConfirm={() => void confirmArchive()}
        busy={busy}
        tone="primary"
        title={respondent.archivedAt ? `Aktifkan ${respondent.code}?` : `Arsipkan ${respondent.code}?`}
        description={respondent.archivedAt ? 'Narasumber akan muncul kembali pada pilihan sesi baru.' : 'Narasumber akan disembunyikan dari pilihan sesi baru.'}
        impact="Sesi dan jawaban yang sudah ada tidak berubah."
        confirmLabel={respondent.archivedAt ? 'Aktifkan' : 'Arsipkan'}
      />

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => void confirmDelete()}
        busy={busy}
        title={`Hapus narasumber ${respondent.code}?`}
        description="Tindakan ini tidak dapat dibatalkan."
        impact={`${sessions.length} sesi dan ${answers} jawaban terisi akan dihapus, termasuk coding dan bukti tema yang merujuk jawaban tersebut. Pertimbangkan mengarsipkan narasumber agar riwayat tetap utuh.`}
        confirmLabel="Hapus permanen"
      />
    </>
  )
}
