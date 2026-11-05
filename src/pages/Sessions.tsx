import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { usePageTitle, useProject } from '../lib/hooks'
import { useWorkspace } from '../lib/store'
import type { InterviewSession } from '../lib/types'
import { SESSION_STATUSES } from '../lib/types'
import { sessionProgress, sessionRespondent } from '../lib/selectors'
import { formatDate, relativeTime } from '../lib/utils'
import { SessionDialog } from '../components/SessionDialog'
import { Icon } from '../components/Icon'
import {
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  IconButton,
  InlineNotice,
  PageHeader,
  Progress,
  SearchInput,
  Select,
  StatusBadge,
  cx,
  useToast,
} from '../components/ui'

export function Sessions() {
  const project = useProject()
  const { data, deleteSession } = useWorkspace()
  const { notify } = useToast()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  usePageTitle('Sesi wawancara')

  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('Semua')
  const [respondentFilter, setRespondentFilter] = useState('Semua')
  const [showArchived, setShowArchived] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [defaultRespondent, setDefaultRespondent] = useState<string | undefined>(undefined)
  const [editing, setEditing] = useState<InterviewSession | null>(null)
  const [deleting, setDeleting] = useState<InterviewSession | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (searchParams.get('baru') !== '1') return
    setDefaultRespondent(searchParams.get('narasumber') ?? undefined)
    setCreateOpen(true)
    const next = new URLSearchParams(searchParams)
    next.delete('baru')
    next.delete('narasumber')
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams])

  const sessions = useMemo(() => {
    if (!project) return []
    return data.sessions
      .filter((session) => session.projectId === project.id)
      .sort((a, b) => new Date(b.interviewDate).getTime() - new Date(a.interviewDate).getTime())
  }, [data.sessions, project])

  const respondents = useMemo(() => {
    if (!project) return []
    return data.respondents.filter((respondent) => respondent.projectId === project.id).sort((a, b) => a.code.localeCompare(b.code, 'id'))
  }, [data.respondents, project])

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return sessions.filter((session) => {
      if (!showArchived && session.status === 'Diarsipkan') return false
      if (statusFilter !== 'Semua' && session.status !== statusFilter) return false
      if (respondentFilter !== 'Semua' && session.respondentId !== respondentFilter) return false
      if (!needle) return true
      const respondent = respondents.find((item) => item.id === session.respondentId)
      return [session.title, session.interviewerName, session.notes, respondent?.code ?? '', respondent?.displayName ?? '']
        .join(' ')
        .toLowerCase()
        .includes(needle)
    })
  }, [sessions, query, statusFilter, respondentFilter, showArchived, respondents])

  if (!project) return null

  const activeRespondents = respondents.filter((respondent) => !respondent.archivedAt)
  const hasFilter = query.trim() !== '' || statusFilter !== 'Semua' || respondentFilter !== 'Semua' || showArchived
  const deletingProgress = deleting ? sessionProgress(data, deleting) : null

  const confirmDelete = async () => {
    if (!deleting) return
    setBusy(true)
    try {
      await deleteSession(deleting.id)
      notify('Sesi beserta jawabannya dihapus permanen.')
      setDeleting(null)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Sesi wawancara"
        description="Satu sesi mewakili satu wawancara dengan satu narasumber. Jawaban dan catatan tersimpan otomatis saat diisi."
        meta={
          <>
            <Badge tone="primary">{sessions.filter((session) => session.status !== 'Diarsipkan').length} sesi</Badge>
            <span className="text-ink-muted">{sessions.filter((session) => session.status === 'Selesai').length} selesai</span>
          </>
        }
        actions={
          <Button
            variant="primary"
            icon="plus"
            onClick={() => {
              setDefaultRespondent(undefined)
              setCreateOpen(true)
            }}
            disabled={activeRespondents.length === 0}
          >
            Sesi baru
          </Button>
        }
      />

      {activeRespondents.length === 0 ? (
        <InlineNotice
          tone="warn"
          className="mb-5"
          title={respondents.length === 0 ? 'Tambahkan narasumber terlebih dahulu' : 'Semua narasumber sedang diarsipkan'}
          action={
            <Link to={`/p/${project.id}/narasumber`}>
              <Button size="sm" variant="secondary" icon="people">
                Buka narasumber
              </Button>
            </Link>
          }
        >
          Sesi membutuhkan narasumber aktif. Tambahkan atau aktifkan narasumber, lalu buat sesi baru.
        </InlineNotice>
      ) : null}

      <section className="rounded-[12px] border border-line bg-surface">
        <div className="flex flex-col gap-3 border-b border-line px-4 py-3.5 sm:px-5">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-[15px] font-semibold text-ink">Daftar sesi</h2>
              <p className="mt-0.5 text-xs text-ink-muted">{filtered.length} ditampilkan dari {sessions.length} sesi.</p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
              <SearchInput value={query} onChange={setQuery} placeholder="Cari sesi…" className="col-span-2 sm:w-52" />
              <Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filter status sesi" className="text-[13px] sm:w-40">
                <option value="Semua">Semua status</option>
                {SESSION_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </Select>
              <Select
                value={respondentFilter}
                onChange={(event) => setRespondentFilter(event.target.value)}
                aria-label="Filter narasumber"
                className="text-[13px] sm:w-44"
              >
                <option value="Semua">Semua narasumber</option>
                {respondents.map((respondent) => (
                  <option key={respondent.id} value={respondent.id}>
                    {respondent.code}
                    {respondent.displayName ? ` · ${respondent.displayName}` : ''}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <label className="flex items-center gap-2 text-xs text-ink-soft">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(event) => setShowArchived(event.target.checked)}
              className="h-4 w-4 rounded border-line-strong accent-[var(--primary)]"
            />
            Tampilkan sesi diarsipkan
          </label>
        </div>

        {sessions.length === 0 ? (
          <div className="p-4 sm:p-5">
            <EmptyState
              icon="session"
              title="Belum ada sesi wawancara"
              description="Buat sesi untuk mulai mencatat jawaban. Daftar pertanyaan diambil dari panduan yang aktif saat sesi dibuat."
              action={
                activeRespondents.length > 0 ? (
                  <Button variant="primary" icon="plus" onClick={() => setCreateOpen(true)}>
                    Buat sesi pertama
                  </Button>
                ) : (
                  <Link to={`/p/${project.id}/narasumber`}>
                    <Button variant="primary" icon="people">
                      Tambah narasumber
                    </Button>
                  </Link>
                )
              }
            />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-4 sm:p-5">
            <EmptyState
              icon="search"
              title="Tidak ada sesi yang cocok"
              description="Ubah kata kunci atau filter untuk menemukan sesi lain."
              action={
                <Button
                  variant="secondary"
                  onClick={() => {
                    setQuery('')
                    setStatusFilter('Semua')
                    setRespondentFilter('Semua')
                    setShowArchived(false)
                  }}
                >
                  Reset filter
                </Button>
              }
            />
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {filtered.map((session) => {
              const respondent = sessionRespondent(data, session)
              const progress = sessionProgress(data, session)
              return (
                <li key={session.id} className={cx('px-4 py-4 transition-colors sm:px-5', session.status === 'Diarsipkan' ? 'bg-surface-2/30' : 'hover:bg-surface-2/30')}>
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-5">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          to={`/p/${project.id}/sesi/${session.id}`}
                          className="min-w-0 truncate text-[14px] font-semibold text-ink transition-colors hover:text-primary"
                        >
                          {session.title}
                        </Link>
                        <StatusBadge status={session.status} />
                      </div>
                      <p className="mt-1 text-[11px] text-ink-muted">
                        {respondent ? `${respondent.code}${respondent.displayName ? ` · ${respondent.displayName}` : ''}` : 'Narasumber tidak ditemukan'} ·{' '}
                        {formatDate(session.interviewDate)} · {session.method}
                        {session.durationMinutes ? ` · ${session.durationMinutes} menit` : ''}
                      </p>
                      {session.interviewerName ? <p className="mt-0.5 text-[11px] text-ink-muted">Pewawancara: {session.interviewerName}</p> : null}
                    </div>

                    <div className="flex items-center gap-3 lg:w-56">
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

                    <div className="flex items-center justify-between gap-2 lg:w-auto lg:justify-end">
                      <span className="text-[11px] text-ink-muted lg:hidden">Diperbarui {relativeTime(session.updatedAt)}</span>
                      <div className="flex items-center gap-0.5">
                        <Link
                          to={`/p/${project.id}/sesi/${session.id}`}
                          className="inline-flex min-h-9 items-center gap-1.5 rounded-[8px] border border-line-strong bg-surface px-2.5 text-[12px] font-medium text-ink transition-colors hover:bg-surface-2 max-sm:h-11"
                        >
                          Buka
                          <Icon name="arrowRight" size={13} />
                        </Link>
                        <IconButton label="Ubah detail sesi" icon="edit" size="sm" onClick={() => setEditing(session)} />
                        <IconButton label="Hapus sesi" icon="trash" size="sm" danger onClick={() => setDeleting(session)} />
                      </div>
                    </div>
                  </div>
                  {session.notes ? <p className="mt-2 line-clamp-1 text-[11px] text-ink-muted">{session.notes}</p> : null}
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-ink-muted">
        <span>{sessions.filter((session) => session.status === 'Draft').length} draft</span>
        <span>{sessions.filter((session) => session.status === 'Berlangsung').length} berlangsung</span>
        <span>{sessions.filter((session) => session.status === 'Perlu Ditinjau').length} perlu ditinjau</span>
        <span>{sessions.filter((session) => session.status === 'Selesai').length} selesai</span>
        {hasFilter ? <span>Filter aktif</span> : null}
      </div>

      <SessionDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        projectId={project.id}
        defaultRespondentId={defaultRespondent}
        onSaved={(session) => navigate(`/p/${project.id}/sesi/${session.id}`)}
      />

      <SessionDialog
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        projectId={project.id}
        session={editing ?? undefined}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={() => void confirmDelete()}
        busy={busy}
        title={deleting ? `Hapus sesi “${deleting.title}”?` : 'Hapus sesi?'}
        description="Tindakan ini tidak dapat dibatalkan."
        impact={
          deleting
            ? `${deletingProgress?.answered ?? 0} jawaban terisi dari ${deletingProgress?.total ?? 0} pertanyaan akan dihapus, termasuk coding dan bukti tema yang merujuk jawaban tersebut. Narasumber dan panduan tetap tersimpan.`
            : ''
        }
        confirmLabel="Hapus sesi"
      />
    </>
  )
}
