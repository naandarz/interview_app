import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { usePageTitle, useProject } from '../lib/hooks'
import { useWorkspace } from '../lib/store'
import type { Respondent } from '../lib/types'
import { respondentAnswerCount, respondentSessions } from '../lib/selectors'
import { formatDate } from '../lib/utils'
import { RespondentDialog } from '../components/RespondentDialog'
import { Icon } from '../components/Icon'
import {
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  IconButton,
  InlineNotice,
  PageHeader,
  SearchInput,
  cx,
  useToast,
} from '../components/ui'

export function Respondents() {
  const project = useProject()
  const { data, archiveRespondent, deleteRespondent } = useWorkspace()
  const { notify } = useToast()
  const navigate = useNavigate()
  usePageTitle('Narasumber')

  const [query, setQuery] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<Respondent | null>(null)
  const [archiving, setArchiving] = useState<Respondent | null>(null)
  const [deleting, setDeleting] = useState<Respondent | null>(null)
  const [busy, setBusy] = useState(false)

  const respondents = useMemo(() => {
    if (!project) return []
    return data.respondents
      .filter((respondent) => respondent.projectId === project.id)
      .sort((a, b) => a.code.localeCompare(b.code, 'id'))
  }, [data.respondents, project])

  const active = respondents.filter((respondent) => !respondent.archivedAt)
  const archived = respondents.filter((respondent) => respondent.archivedAt)

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return respondents.filter((respondent) => {
      if (!showArchived && respondent.archivedAt) return false
      if (!needle) return true
      return (
        respondent.code.toLowerCase().includes(needle) ||
        respondent.displayName.toLowerCase().includes(needle) ||
        respondent.profileNotes.toLowerCase().includes(needle)
      )
    })
  }, [respondents, query, showArchived])

  if (!project) return null

  const sessionsOf = (id: string) => respondentSessions(data, id)
  const deletingSessions = deleting ? sessionsOf(deleting.id) : []
  const deletingAnswers = deleting ? respondentAnswerCount(data, deleting.id) : 0

  const confirmDelete = async () => {
    if (!deleting) return
    setBusy(true)
    try {
      await deleteRespondent(deleting.id)
      notify('Narasumber beserta sesi dan jawabannya dihapus permanen.')
      setDeleting(null)
    } finally {
      setBusy(false)
    }
  }

  const confirmArchive = async () => {
    if (!archiving) return
    setBusy(true)
    try {
      const willArchive = !archiving.archivedAt
      await archiveRespondent(archiving.id, willArchive)
      notify(willArchive ? 'Narasumber diarsipkan. Sesi dan jawaban tetap tersimpan.' : 'Narasumber diaktifkan kembali.')
      setArchiving(null)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Narasumber"
        description="Catat siapa yang diwawancarai dengan kode unik. Satu narasumber dapat memiliki beberapa sesi."
        meta={
          <>
            <Badge tone="primary">{active.length} aktif</Badge>
            {archived.length > 0 ? <Badge tone="neutral">{archived.length} diarsipkan</Badge> : null}
            <span className="text-ink-muted">Kode harus unik dalam satu proyek</span>
          </>
        }
        actions={
          <Button variant="primary" icon="plus" onClick={() => setCreateOpen(true)}>
            Tambah narasumber
          </Button>
        }
      />

      {archived.length > 0 && active.length === 0 ? (
        <InlineNotice
          tone="warn"
          className="mb-4"
          title="Semua narasumber sedang diarsipkan"
          action={
            <Button size="sm" variant="secondary" onClick={() => setShowArchived(true)}>
              Tampilkan arsip
            </Button>
          }
        >
          Sesi lama tetap dapat dibuka, tetapi narasumber yang diarsipkan tidak muncul saat membuat sesi baru.
        </InlineNotice>
      ) : null}

      <section className="rounded-[12px] border border-line bg-surface">
        <div className="flex flex-col gap-3 border-b border-line px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div>
            <h2 className="text-[15px] font-semibold text-ink">Daftar narasumber</h2>
            <p className="mt-0.5 text-xs text-ink-muted">{filtered.length} ditampilkan dari {respondents.length} total.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <SearchInput value={query} onChange={setQuery} placeholder="Cari kode atau nama…" className="sm:w-56" />
            <label className="flex items-center gap-2 text-xs text-ink-soft sm:pl-1">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(event) => setShowArchived(event.target.checked)}
                className="h-4 w-4 rounded border-line-strong accent-[var(--primary)]"
              />
              Tampilkan arsip
            </label>
          </div>
        </div>

        {respondents.length === 0 ? (
          <div className="p-4 sm:p-5">
            <EmptyState
              icon="people"
              title="Belum ada narasumber"
              description="Tambahkan narasumber sebelum membuat sesi. Gunakan kode seperti R01 bila nama lengkap tidak diperlukan."
              action={
                <Button variant="primary" icon="plus" onClick={() => setCreateOpen(true)}>
                  Tambah narasumber pertama
                </Button>
              }
            />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-4 sm:p-5">
            <EmptyState
              icon="search"
              title="Tidak ada narasumber yang cocok"
              description="Ubah kata kunci atau tampilkan arsip untuk menemukan narasumber lain."
              action={
                <Button
                  variant="secondary"
                  onClick={() => {
                    setQuery('')
                    setShowArchived(true)
                  }}
                >
                  Reset filter
                </Button>
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-left">
              <thead>
                <tr className="border-b border-line text-[10px] uppercase tracking-wide text-ink-muted">
                  <th scope="col" className="px-4 py-2.5 font-medium sm:px-5">Narasumber</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Sesi</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Jawaban</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Sesi terakhir</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Status</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-medium sm:px-5">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((respondent) => {
                  const sessions = sessionsOf(respondent.id)
                  const answers = respondentAnswerCount(data, respondent.id)
                  const latest = sessions[0]
                  return (
                    <tr key={respondent.id} className={cx('border-b border-line last:border-b-0', respondent.archivedAt ? 'bg-surface-2/30' : 'hover:bg-surface-2/30')}>
                      <td className="px-4 py-3 sm:px-5">
                        <div className="flex items-start gap-2.5">
                          <span className="mt-0.5 inline-flex h-8 min-w-8 shrink-0 items-center justify-center rounded-[7px] bg-primary-soft px-1.5 font-mono text-[11px] font-semibold text-primary">
                            {respondent.code}
                          </span>
                          <div className="min-w-0">
                            <Link to={`/p/${project.id}/narasumber/${respondent.id}`} className="block truncate text-[13px] font-semibold text-ink hover:text-primary">
                              {respondent.displayName || 'Tanpa nama tampilan'}
                            </Link>
                            <p className="mt-0.5 line-clamp-1 text-[11px] text-ink-muted">
                              {respondent.profileNotes || 'Belum ada catatan profil.'}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-[13px] text-ink-soft">{sessions.length}</td>
                      <td className="px-3 py-3 text-[13px] text-ink-soft">{answers}</td>
                      <td className="px-3 py-3 text-[11px] text-ink-muted">
                        {latest ? (
                          <>
                            <span className="block text-[12px] text-ink-soft">{formatDate(latest.interviewDate)}</span>
                            <span>{latest.title}</span>
                          </>
                        ) : (
                          'Belum ada sesi'
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {respondent.archivedAt ? <Badge tone="neutral">Diarsipkan</Badge> : <Badge tone="success">Aktif</Badge>}
                      </td>
                      <td className="px-4 py-3 sm:px-5">
                        <div className="flex items-center justify-end gap-0.5">
                          <Link
                            to={`/p/${project.id}/narasumber/${respondent.id}`}
                            className="hidden min-h-8 items-center gap-1 rounded px-2 text-xs font-medium text-primary hover:bg-primary-soft sm:inline-flex"
                          >
                            Buka
                          </Link>
                          <IconButton label="Buat sesi baru" icon="plus" size="sm" onClick={() => navigate(`/p/${project.id}/sesi?baru=1&narasumber=${respondent.id}`)} />
                          <IconButton label="Ubah narasumber" icon="edit" size="sm" onClick={() => setEditing(respondent)} />
                          <IconButton
                            label={respondent.archivedAt ? 'Aktifkan narasumber' : 'Arsipkan narasumber'}
                            icon="archive"
                            size="sm"
                            onClick={() => setArchiving(respondent)}
                          />
                          <IconButton label="Hapus narasumber" icon="trash" size="sm" danger onClick={() => setDeleting(respondent)} />
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-[10px] border border-line bg-surface px-4 py-3">
          <p className="mono-meta uppercase text-ink-muted">Narasumber aktif</p>
          <p className="mt-1 text-[20px] font-semibold text-ink">{active.length}</p>
          <p className="mt-0.5 text-[11px] text-ink-muted">Dapat dipilih saat membuat sesi baru.</p>
        </div>
        <div className="rounded-[10px] border border-line bg-surface px-4 py-3">
          <p className="mono-meta uppercase text-ink-muted">Sudah diwawancarai</p>
          <p className="mt-1 text-[20px] font-semibold text-ink">{active.filter((respondent) => sessionsOf(respondent.id).length > 0).length}</p>
          <p className="mt-0.5 text-[11px] text-ink-muted">Memiliki minimal satu sesi.</p>
        </div>
        <div className="rounded-[10px] border border-line bg-surface px-4 py-3">
          <p className="mono-meta uppercase text-ink-muted">Belum diwawancarai</p>
          <p className="mt-1 text-[20px] font-semibold text-ink">{active.filter((respondent) => sessionsOf(respondent.id).length === 0).length}</p>
          <p className="mt-0.5 text-[11px] text-ink-muted">Belum memiliki sesi wawancara.</p>
        </div>
      </section>

      <p className="mt-4 flex items-start gap-1.5 text-xs leading-relaxed text-ink-muted">
        <Icon name="lock" size={13} className="mt-0.5 shrink-0" />
        Profil narasumber disimpan di perangkat ini. Hindari mencatat data pribadi yang tidak diperlukan untuk penelitian.
      </p>

      <RespondentDialog open={createOpen} onClose={() => setCreateOpen(false)} projectId={project.id} />
      <RespondentDialog
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        projectId={project.id}
        respondent={editing ?? undefined}
      />

      <ConfirmDialog
        open={Boolean(archiving)}
        onClose={() => setArchiving(null)}
        onConfirm={() => void confirmArchive()}
        busy={busy}
        tone="primary"
        title={archiving?.archivedAt ? `Aktifkan ${archiving.code}?` : `Arsipkan ${archiving?.code ?? 'narasumber'}?`}
        description={
          archiving?.archivedAt
            ? 'Narasumber akan muncul kembali pada pilihan sesi baru.'
            : 'Narasumber akan disembunyikan dari pilihan sesi baru.'
        }
        impact={
          archiving?.archivedAt
            ? 'Sesi dan jawaban yang sudah ada tidak berubah.'
            : 'Sesi, jawaban, dan coding yang sudah ada tetap tersimpan dan dapat dibuka dari daftar sesi. Hanya pilihan narasumber yang disembunyikan.'
        }
        confirmLabel={archiving?.archivedAt ? 'Aktifkan' : 'Arsipkan'}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={() => void confirmDelete()}
        busy={busy}
        title={deleting ? `Hapus narasumber ${deleting.code}?` : 'Hapus narasumber?'}
        description="Tindakan ini tidak dapat dibatalkan."
        impact={
          deleting
            ? `${deletingSessions.length} sesi dan ${deletingAnswers} jawaban terisi milik narasumber ini akan dihapus, termasuk coding dan bukti tema yang merujuk jawaban tersebut. Pertimbangkan mengarsipkan narasumber agar riwayat tetap utuh.`
            : ''
        }
        confirmLabel="Hapus permanen"
      />
    </>
  )
}
