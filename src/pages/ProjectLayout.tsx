import { useEffect } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { useWorkspace } from '../lib/store'
import { useProject } from '../lib/hooks'
import { projectQuestions, projectRespondents, projectSessions } from '../lib/selectors'
import { EmptyState, Button, cx } from '../components/ui'

const TABS = [
  { to: '', label: 'Ikhtisar', end: true, key: 'ikhtisar' },
  { to: 'dokumen', label: 'Dokumen', key: 'dokumen' },
  { to: 'panduan', label: 'Panduan', key: 'panduan' },
  { to: 'narasumber', label: 'Narasumber', key: 'narasumber' },
  { to: 'sesi', label: 'Sesi', key: 'sesi' },
  { to: 'data', label: 'Data jawaban', key: 'data' },
  { to: 'analisis', label: 'Analisis', key: 'analisis' },
  { to: 'ekspor', label: 'Ekspor', key: 'ekspor' },
  { to: 'pengaturan', label: 'Pengaturan', key: 'pengaturan' },
]

export function ProjectLayout() {
  const project = useProject()
  const { data, touchProject } = useWorkspace()

  useEffect(() => {
    if (project) touchProject(project.id)
  }, [project, touchProject])

  if (!project) {
    return (
      <EmptyState
        icon="alert"
        title="Proyek tidak ditemukan"
        description="Proyek ini mungkin sudah dihapus, atau tautannya tidak lagi berlaku. Kembali ke dasbor untuk memilih proyek lain."
        action={
          <Link to="/">
            <Button variant="primary" icon="arrowLeft">
              Kembali ke dasbor
            </Button>
          </Link>
        }
      />
    )
  }

  const sessions = projectSessions(data, project.id).length
  const respondents = projectRespondents(data, project.id).length
  const questions = projectQuestions(data, project.id).length

  return (
    <div>
      <div className="mb-6 border-b border-line">
        <nav aria-label="Bagian proyek" className="-mx-4 flex gap-1 overflow-x-auto px-4 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0">
          {TABS.map((tab) => {
            const count = tab.key === 'sesi' ? sessions : tab.key === 'narasumber' ? respondents : tab.key === 'panduan' ? questions : undefined
            return (
              <NavLink
                key={tab.key}
                to={`/p/${project.id}${tab.to ? `/${tab.to}` : ''}`}
                end={tab.end}
                className={({ isActive }) =>
                  cx(
                    'relative inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-t-md px-2.5 text-[13px] font-medium transition-colors duration-150 sm:px-3',
                    isActive ? 'text-primary' : 'text-ink-muted hover:bg-surface-2/70 hover:text-ink',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    {tab.label}
                    {count !== undefined ? (
                      <span className={cx('mono-meta rounded px-1.5 py-0.5 text-[10px]', isActive ? 'bg-primary-soft text-primary' : 'bg-surface-2 text-ink-muted')}>
                        {count}
                      </span>
                    ) : null}
                    {isActive ? <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-primary" aria-hidden="true" /> : null}
                  </>
                )}
              </NavLink>
            )
          })}
        </nav>
      </div>
      <Outlet />
    </div>
  )
}
