import { HashRouter, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { ErrorBoundary } from './components/ErrorBoundary'
import { Icon } from './components/Icon'
import { Spinner, ToastProvider } from './components/ui'
import { ThemeProvider } from './lib/theme'
import { WorkspaceProvider, useWorkspace } from './lib/store'
import { Dashboard } from './pages/Dashboard'
import { Documents } from './pages/Documents'
import { Guide } from './pages/Guide'
import { Respondents } from './pages/Respondents'
import { RespondentDetail } from './pages/RespondentDetail'
import { Sessions } from './pages/Sessions'
import { SessionWorkspace } from './pages/SessionWorkspace'
import { DataCenter } from './pages/DataCenter'
import { Analysis } from './pages/Analysis'
import { ExportPage } from './pages/ExportPage'
import { Settings } from './pages/Settings'
import { ProjectLayout } from './pages/ProjectLayout'
import { ProjectOverview } from './pages/ProjectOverview'
import { ProjectSettings } from './pages/ProjectSettings'
import { Onboarding } from './pages/Onboarding'
import { NotFound } from './pages/NotFound'

function Splash() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-paper px-6" role="status" aria-live="polite">
      <div className="flex items-center gap-2.5">
        <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-[9px] bg-primary text-primary-ink">
          <Icon name="guide" size={19} />
          <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full border border-paper bg-accent" aria-hidden="true" />
        </span>
        <span>
          <span className="block text-[15px] font-semibold leading-tight tracking-[-0.01em] text-ink">
            Interview Workspace
          </span>
          <span className="mono-meta mt-0.5 block text-[10px] uppercase text-ink-muted">Catatan lapangan</span>
        </span>
      </div>
      <span className="mt-6 flex items-center gap-2 text-[13px] text-ink-muted">
        <Spinner size={15} />
        Membuka ruang kerja…
      </span>
    </div>
  )
}

function WorkspaceGate() {
  const { ready, profileLoaded, profile, hasSeenWelcome, data } = useWorkspace()

  if (!ready || !profileLoaded) return <Splash />
  if (!profile && !hasSeenWelcome && data.projects.length === 0) return <Onboarding />

  return (
    <HashRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Dashboard />} />
          <Route path="pengaturan" element={<Settings />} />
          <Route path="p/:projectId" element={<ProjectLayout />}>
            <Route index element={<ProjectOverview />} />
            <Route path="dokumen" element={<Documents />} />
            <Route path="panduan" element={<Guide />} />
            <Route path="narasumber" element={<Respondents />} />
            <Route path="sesi" element={<Sessions />} />
            <Route path="data" element={<DataCenter />} />
            <Route path="analisis" element={<Analysis />} />
            <Route path="ekspor" element={<ExportPage />} />
            <Route path="pengaturan" element={<ProjectSettings />} />
          </Route>
          <Route path="p/:projectId/narasumber/:respondentId" element={<RespondentDetail />} />
          <Route path="p/:projectId/sesi/:sessionId" element={<SessionWorkspace />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <WorkspaceProvider>
          <ErrorBoundary>
            <WorkspaceGate />
          </ErrorBoundary>
        </WorkspaceProvider>
      </ToastProvider>
    </ThemeProvider>
  )
}
