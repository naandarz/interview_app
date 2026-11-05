import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { Icon, type IconName } from './Icon'
import { Button, Drawer, IconButton, InlineNotice, Spinner, cx } from './ui'
import { useWorkspace } from '../lib/store'
import { useTheme } from '../lib/theme'
import { projectSessions } from '../lib/selectors'

interface NavItem {
  label: string
  to: string
  icon: IconName
  end?: boolean
  count?: number
}

const PROJECT_PAGES: Record<string, string> = {
  '': 'Ikhtisar',
  dokumen: 'Dokumen sumber',
  panduan: 'Panduan',
  narasumber: 'Narasumber',
  sesi: 'Sesi wawancara',
  data: 'Data jawaban',
  analisis: 'Analisis',
  ekspor: 'Ekspor',
  pengaturan: 'Pengaturan proyek',
}

function Brand() {
  return (
    <Link to="/" className="group flex items-center gap-2.5 rounded-lg">
      <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-[9px] bg-primary text-primary-ink shadow-[0_1px_0_rgba(0,0,0,0.08)]">
        <Icon name="guide" size={18} />
        <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full border border-surface bg-accent" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block text-[14px] font-semibold leading-tight tracking-[-0.01em] text-ink">Interview Workspace</span>
        <span className="mono-meta mt-0.5 block text-[10px] uppercase text-ink-muted">Catatan lapangan</span>
      </span>
    </Link>
  )
}

function NavRow({ item, onNavigate }: { item: NavItem; onNavigate?: () => void }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onNavigate}
      className={({ isActive }) =>
        cx(
          'group flex min-h-10 items-center gap-2.5 rounded-[8px] px-2.5 py-2 text-[13.5px] font-medium transition-colors duration-150',
          isActive ? 'bg-primary-soft text-primary' : 'text-ink-soft hover:bg-surface-2 hover:text-ink',
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon name={item.icon} size={17} className={cx('shrink-0', isActive ? 'text-primary' : 'text-ink-muted group-hover:text-ink-soft')} />
          <span className="min-w-0 flex-1 truncate">{item.label}</span>
          {item.count !== undefined ? (
            <span className={cx('mono-meta rounded px-1.5 py-0.5 text-[10px]', isActive ? 'bg-surface/70 text-primary' : 'bg-surface-2 text-ink-muted')}>
              {item.count}
            </span>
          ) : null}
        </>
      )}
    </NavLink>
  )
}

function NavContent({ onNavigate }: { onNavigate?: () => void }) {
  const { data } = useWorkspace()
  const location = useLocation()
  const match = location.pathname.match(/^\/p\/([^/]+)/)
  const activeProject = match ? data.projects.find((project) => project.id === match[1]) : undefined
  const recentProjects = [...data.projects]
    .filter((project) => project.status !== 'Diarsipkan')
    .sort((a, b) => new Date(b.lastOpenedAt ?? b.updatedAt).getTime() - new Date(a.lastOpenedAt ?? a.updatedAt).getTime())
    .slice(0, 6)

  const projectNav: NavItem[] = activeProject
    ? [
        { label: 'Ikhtisar', to: `/p/${activeProject.id}`, icon: 'overview', end: true },
        { label: 'Dokumen sumber', to: `/p/${activeProject.id}/dokumen`, icon: 'document' },
        { label: 'Panduan', to: `/p/${activeProject.id}/panduan`, icon: 'guide' },
        { label: 'Narasumber', to: `/p/${activeProject.id}/narasumber`, icon: 'people' },
        {
          label: 'Sesi wawancara',
          to: `/p/${activeProject.id}/sesi`,
          icon: 'session',
          count: projectSessions(data, activeProject.id).length,
        },
        { label: 'Data jawaban', to: `/p/${activeProject.id}/data`, icon: 'data' },
        { label: 'Analisis', to: `/p/${activeProject.id}/analisis`, icon: 'analysis' },
        { label: 'Ekspor', to: `/p/${activeProject.id}/ekspor`, icon: 'export' },
        { label: 'Pengaturan proyek', to: `/p/${activeProject.id}/pengaturan`, icon: 'settings' },
      ]
    : []

  return (
    <div className="flex flex-col gap-5">
      {activeProject ? (
        <div>
          <Link
            to="/"
            onClick={onNavigate}
            className="mb-3 inline-flex min-h-8 items-center gap-1.5 rounded px-1 text-xs font-medium text-ink-muted transition-colors hover:text-ink"
          >
            <Icon name="arrowLeft" size={14} />
            Semua proyek
          </Link>
          <div className="rounded-[10px] border border-line bg-surface-2/60 px-3 py-2.5">
            <p className="mono-meta uppercase text-ink-muted">Proyek aktif</p>
            <p className="mt-1 line-clamp-2 text-[13px] font-semibold leading-snug text-ink">{activeProject.title}</p>
          </div>
          <nav aria-label="Navigasi proyek" className="mt-2 flex flex-col gap-0.5">
            {projectNav.map((item) => (
              <NavRow key={item.to} item={item} onNavigate={onNavigate} />
            ))}
          </nav>
        </div>
      ) : (
        <div>
          <p className="mono-meta mb-1.5 px-2.5 uppercase text-ink-muted">Utama</p>
          <nav aria-label="Navigasi utama" className="flex flex-col gap-0.5">
            <NavRow item={{ label: 'Dasbor', to: '/', icon: 'overview', end: true }} onNavigate={onNavigate} />
            <NavRow item={{ label: 'Pengaturan', to: '/pengaturan', icon: 'settings' }} onNavigate={onNavigate} />
          </nav>
        </div>
      )}

      {activeProject ? (
        <div>
          <p className="mono-meta mb-1.5 px-2.5 uppercase text-ink-muted">Utama</p>
          <nav aria-label="Navigasi utama" className="flex flex-col gap-0.5">
            <NavRow item={{ label: 'Dasbor', to: '/', icon: 'overview', end: true }} onNavigate={onNavigate} />
            <NavRow item={{ label: 'Pengaturan', to: '/pengaturan', icon: 'settings' }} onNavigate={onNavigate} />
          </nav>
        </div>
      ) : null}

      <div>
        <div className="mb-1.5 flex items-center justify-between px-2.5">
          <p className="mono-meta uppercase text-ink-muted">Proyek</p>
          <span className="mono-meta text-ink-muted">{data.projects.length}</span>
        </div>
        {recentProjects.length === 0 ? (
          <p className="px-2.5 text-xs leading-relaxed text-ink-muted">Belum ada proyek. Buat proyek pertama dari dasbor.</p>
        ) : (
          <nav aria-label="Daftar proyek" className="flex flex-col gap-0.5">
            {recentProjects.map((project) => {
              const active = project.id === activeProject?.id
              return (
                <Link
                  key={project.id}
                  to={`/p/${project.id}`}
                  onClick={onNavigate}
                  className={cx(
                    'flex min-h-9 items-center gap-2 rounded-[8px] px-2.5 py-1.5 text-[13px] transition-colors duration-150',
                    active ? 'text-primary' : 'text-ink-soft hover:bg-surface-2 hover:text-ink',
                  )}
                >
                  <span className={cx('h-1.5 w-1.5 shrink-0 rounded-full', active ? 'bg-primary' : 'bg-line-strong')} aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate">{project.title}</span>
                  {project.status === 'Diarsipkan' ? <Icon name="archive" size={13} className="text-ink-muted" /> : null}
                </Link>
              )
            })}
          </nav>
        )}
      </div>
    </div>
  )
}

function SidebarFooter() {
  const { resolved, toggle } = useTheme()
  return (
    <div className="border-t border-line px-3 py-3">
      <div className="flex items-center justify-between gap-2 rounded-[9px] px-1.5 py-1">
        <span className="flex items-center gap-1.5 text-[11px] leading-tight text-ink-muted">
          <Icon name="database" size={13} className="shrink-0" />
          Data tersimpan di perangkat ini
        </span>
        <IconButton label={resolved === 'dark' ? 'Gunakan tema terang' : 'Gunakan tema gelap'} icon={resolved === 'dark' ? 'sun' : 'moon'} size="sm" onClick={toggle} />
      </div>
    </div>
  )
}

function HeaderSave() {
  const { saveState, retrySave } = useWorkspace()
  if (saveState === 'saving') {
    return (
      <span className="flex items-center gap-1.5 text-xs text-ink-muted" aria-live="polite">
        <Spinner size={12} />
        <span className="hidden sm:inline">Menyimpan</span>
        <span className="sr-only sm:hidden">Menyimpan</span>
      </span>
    )
  }
  if (saveState === 'saved') {
    return (
      <span className="flex items-center gap-1.5 text-xs text-ink-muted" aria-live="polite">
        <Icon name="checkCircle" size={13} className="text-success" />
        <span className="hidden sm:inline">Tersimpan di perangkat</span>
        <span className="sr-only sm:hidden">Tersimpan di perangkat</span>
      </span>
    )
  }
  if (saveState === 'error') {
    return (
      <button type="button" onClick={retrySave} className="flex min-h-9 items-center gap-1.5 rounded-md px-1.5 text-xs text-danger hover:bg-danger-soft">
        <Icon name="alert" size={13} />
        <span className="hidden sm:inline">Gagal menyimpan. Coba lagi</span>
        <span className="sm:hidden">Gagal</span>
      </button>
    )
  }
  return null
}

function Breadcrumb({ projectTitle }: { projectTitle?: string }) {
  const location = useLocation()
  const match = location.pathname.match(/^\/p\/([^/]+)\/?(.*)$/)
  if (!match) {
    if (location.pathname === '/pengaturan') return <span className="text-[13px] font-medium text-ink">Pengaturan</span>
    return <span className="text-[13px] font-medium text-ink">Dasbor</span>
  }
  const rest = match[2].split('/')[0] ?? ''
  const page = PROJECT_PAGES[rest] ?? 'Ikhtisar'
  return (
    <div className="flex min-w-0 items-center gap-1.5 text-[13px]">
      <Link to="/" className="hidden shrink-0 text-ink-muted transition-colors hover:text-ink sm:inline">
        Dasbor
      </Link>
      <Icon name="chevronRight" size={13} className="hidden shrink-0 text-line-strong sm:inline" />
      <span className="max-w-[9rem] truncate text-ink-muted sm:max-w-[16rem]" title={projectTitle}>
        {projectTitle ?? 'Proyek'}
      </span>
      <Icon name="chevronRight" size={13} className="shrink-0 text-line-strong" />
      <span className="shrink-0 font-medium text-ink">{page}</span>
    </div>
  )
}

export function AppShell() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const { data, saveState, saveError, storageError, retrySave } = useWorkspace()
  const { toggle, resolved } = useTheme()
  const location = useLocation()
  const match = location.pathname.match(/^\/p\/([^/]+)/)
  const activeProject = match ? data.projects.find((project) => project.id === match[1]) : undefined

  useEffect(() => {
    setMobileOpen(false)
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [location.pathname])

  return (
    <div className="min-h-dvh bg-paper">
      <a
        href="#konten-utama"
        className="sr-only z-[80] rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-ink focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Lewati ke konten utama
      </a>

      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[268px] flex-col border-r border-line bg-surface/70 backdrop-blur-sm lg:flex">
        <div className="px-4 pb-5 pt-5">
          <Brand />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-2.5 pb-4">
          <NavContent />
        </div>
        <SidebarFooter />
      </aside>

      <div className="lg:pl-[268px]">
        <header className="sticky top-0 z-20 border-b border-line bg-paper/90 backdrop-blur-md">
          <div className="flex h-14 items-center gap-2 px-3 sm:gap-3 sm:px-6 lg:px-8">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Buka navigasi"
              className="-ml-1 inline-flex h-11 w-11 items-center justify-center rounded-lg text-ink-soft hover:bg-surface-2 hover:text-ink lg:hidden"
            >
              <Icon name="menu" size={20} />
            </button>
            <Breadcrumb projectTitle={activeProject?.title} />
            <div className="ml-auto flex items-center gap-1 sm:gap-2">
              <HeaderSave />
              <span className="mx-1 hidden h-4 w-px bg-line sm:block" aria-hidden="true" />
              <IconButton
                label={resolved === 'dark' ? 'Gunakan tema terang' : 'Gunakan tema gelap'}
                icon={resolved === 'dark' ? 'sun' : 'moon'}
                onClick={toggle}
                size="sm"
                variant="ghost"
              />
            </div>
          </div>
          {saveState === 'error' ? (
            <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 border-t border-danger/20 bg-danger-soft px-4 py-1.5 text-center text-xs text-danger sm:px-6">
              <span>
                {saveError ?? 'Perubahan terakhir belum tersimpan. Periksa ruang penyimpanan browser lalu coba lagi.'}
              </span>
              <button type="button" onClick={retrySave} className="font-semibold underline underline-offset-2">
                Coba lagi
              </button>
            </div>
          ) : null}
        </header>

        <main id="konten-utama" className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          {storageError ? (
            <InlineNotice
              tone="danger"
              title="Penyimpanan browser tidak dapat dibuka"
              className="mb-6"
              action={
                <Button variant="secondary" size="sm" onClick={() => window.location.reload()}>
                  Muat ulang
                </Button>
              }
            >
              {storageError} Data tidak akan tersimpan sampai masalah ini diperbaiki. Pastikan mode privat tidak
              memblokir IndexedDB.
            </InlineNotice>
          ) : null}
          <Outlet />
        </main>
      </div>

      <Drawer open={mobileOpen} onClose={() => setMobileOpen(false)} title="Navigasi" width="md">
        <div className="mb-5">
          <Brand />
        </div>
        <NavContent onNavigate={() => setMobileOpen(false)} />
      </Drawer>
    </div>
  )
}
