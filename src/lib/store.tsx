import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type {
  AnalysisMemo,
  Answer,
  AnswerCode,
  Category,
  Code,
  ExportRecord,
  InterviewSession,
  Profile,
  Project,
  ProjectStatus,
  Question,
  Respondent,
  Section,
  SourceDocument,
  Theme,
  ThemeEvidence,
  WorkspaceData,
} from './types'
import { COUNTED_STATUSES } from './types'
import {
  clearData,
  deleteMany,
  deleteRecord,
  getAll,
  getMeta,
  loadWorkspace,
  putMany,
  putRecord,
  replaceWorkspace,
  setMeta,
  type StoreName,
} from './db'
import { nowIso, uid } from './utils'
import { buildDemoWorkspace } from './seed'
import {
  connectGoogleDrive,
  deleteProjectSnapshotFromDrive,
  disconnectGoogleDrive,
  getConnectedUserEmail,
  isGoogleDriveConnected,
  uploadProjectSnapshotToDrive,
} from './googleDrive'
import {
  SCHEMA_VERSION,
  buildProjectBackup,
  buildWorkspaceBackup,
  downloadJson,
  parseProjectBackup,
  parseWorkspaceBackup,
  remapProjectBackup,
  suggestBackupFileName,
} from './backup'

export type SaveState = 'idle' | 'saving' | 'saved' | 'error'

const EMPTY: WorkspaceData = {
  projects: [],
  documents: [],
  sections: [],
  questions: [],
  respondents: [],
  sessions: [],
  answers: [],
  codes: [],
  answerCodes: [],
  categories: [],
  codeCategories: [],
  themes: [],
  themeCategories: [],
  themeEvidence: [],
  memos: [],
  exports: [],
}

function normalizeWorkspace(data: WorkspaceData): WorkspaceData {
  return {
    ...EMPTY,
    ...data,
    projects: (data.projects ?? []).map((project) => ({
      ...project,
      backupEnabled: project.backupEnabled ?? false,
      localRevision: typeof project.localRevision === 'number' && project.localRevision > 0 ? project.localRevision : 1,
      syncStatus: project.syncStatus ?? 'Belum dicadangkan',
      lastSyncedAt: project.lastSyncedAt ?? null,
      remoteFileId: project.remoteFileId ?? null,
      lastSyncedRevision: project.lastSyncedRevision ?? null,
      lastSyncError: project.lastSyncError ?? null,
    })),
  }
}

function describeStorageError(error: unknown): string {
  if (error instanceof DOMException && (error.name === 'QuotaExceededError' || error.code === 22)) {
    return 'Ruang penyimpanan browser penuh. Unduh backup, hapus data yang tidak diperlukan, lalu coba lagi.'
  }
  if (error instanceof Error && error.message) return error.message
  return 'Penulisan ke penyimpanan browser gagal. Periksa ruang penyimpanan dan mode privat browser.'
}

export interface WorkspaceContextValue {
  data: WorkspaceData
  ready: boolean
  storageError: string | null
  saveError: string | null
  saveState: SaveState
  profile: Profile | null
  profileLoaded: boolean
  hasSeenWelcome: boolean
  dismissOnboarding: () => Promise<void>
  saveProfile: (profile: Profile) => Promise<void>
  retrySave: () => void
  flushAnswers: () => Promise<void>
  createProject: (input: {
    title: string
    description: string
    objective: string
    generalNotes: string
    backupEnabled?: boolean
  }) => Promise<Project | null>
  updateProject: (id: string, patch: Partial<Project>) => Promise<boolean>
  setProjectBackup: (id: string, enabled: boolean) => Promise<boolean>
  exportProjectBackup: (id: string) => boolean
  restoreProjectBackup: (
    json: string,
    mode: 'new' | 'replace',
    targetProjectId?: string,
  ) => Promise<{ ok: boolean; error?: string; projectId?: string }>
  syncProject: (id: string) => Promise<{ ok: boolean; error?: string }>
  deleteCloudBackup: (id: string) => Promise<{ ok: boolean; error?: string }>
  googleDriveConnected: boolean
  googleAccount: string | null
  connectDrive: (customClientId?: string) => Promise<{ ok: boolean; error?: string }>
  disconnectDrive: () => void
  setProjectStatus: (id: string, status: ProjectStatus) => Promise<void>
  touchProject: (id: string) => void
  deleteProject: (id: string) => Promise<void>
  addDocument: (doc: SourceDocument) => Promise<void>
  deleteDocument: (id: string) => Promise<void>
  createSection: (projectId: string, title: string, description: string) => Promise<Section | null>
  updateSection: (id: string, patch: Partial<Section>) => Promise<void>
  deleteSection: (id: string) => Promise<void>
  reorderSections: (projectId: string, ids: string[]) => Promise<void>
  createQuestion: (input: Omit<Question, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Question | null>
  updateQuestion: (id: string, patch: Partial<Question>) => Promise<void>
  deleteQuestion: (id: string) => Promise<void>
  bulkCreateQuestions: (
    projectId: string,
    items: Array<{ text: string; guidance: string; sectionTitle: string | null; isRequired: boolean }>,
    sourceDocumentId: string | null,
  ) => Promise<number>
  reorderQuestions: (projectId: string, orderedIds: string[]) => Promise<void>
  createRespondent: (input: { projectId: string; code: string; displayName: string; profileNotes: string }) => Promise<{ ok: boolean; error?: string; respondent?: Respondent }>
  updateRespondent: (id: string, patch: Partial<Respondent>) => Promise<void>
  archiveRespondent: (id: string, archived: boolean) => Promise<void>
  deleteRespondent: (id: string) => Promise<void>
  createSession: (input: {
    projectId: string
    respondentId: string
    title: string
    interviewDate: string
    method: InterviewSession['method']
    interviewerName: string
    durationMinutes: number | null
    notes: string
  }) => Promise<InterviewSession | null>
  updateSession: (id: string, patch: Partial<InterviewSession>) => Promise<void>
  deleteSession: (id: string) => Promise<void>
  refreshSessionQuestions: (sessionId: string) => Promise<number>
  updateAnswer: (id: string, patch: Partial<Pick<Answer, 'text' | 'interviewerNotes' | 'status'>>) => void
  createCode: (projectId: string, name: string, description: string, color: string) => Promise<Code | null>
  updateCode: (id: string, patch: Partial<Code>) => Promise<void>
  deleteCode: (id: string) => Promise<void>
  addAnswerCode: (input: { projectId: string; answerId: string; codeId: string; excerpt: string | null; note: string }) => Promise<AnswerCode | null>
  updateAnswerCode: (id: string, patch: Partial<AnswerCode>) => Promise<void>
  deleteAnswerCode: (id: string) => Promise<void>
  createCategory: (projectId: string, name: string, description: string) => Promise<Category | null>
  updateCategory: (id: string, patch: Partial<Category>) => Promise<void>
  deleteCategory: (id: string) => Promise<void>
  toggleCodeCategory: (projectId: string, codeId: string, categoryId: string) => Promise<void>
  createTheme: (projectId: string, name: string, description: string, interpretation: string) => Promise<Theme | null>
  updateTheme: (id: string, patch: Partial<Theme>) => Promise<void>
  deleteTheme: (id: string) => Promise<void>
  toggleThemeCategory: (projectId: string, themeId: string, categoryId: string) => Promise<void>
  addThemeEvidence: (input: { projectId: string; themeId: string; answerId: string; excerpt: string; note: string }) => Promise<ThemeEvidence | null>
  deleteThemeEvidence: (id: string) => Promise<void>
  createMemo: (projectId: string, themeId: string | null, content: string) => Promise<AnalysisMemo | null>
  deleteMemo: (id: string) => Promise<void>
  addExportRecord: (record: ExportRecord) => Promise<void>
  deleteExportRecord: (id: string) => Promise<void>
  loadDemo: () => Promise<string | null>
  backupWorkspace: () => void
  restoreWorkspace: (json: string) => Promise<{ ok: boolean; error?: string }>
  resetAll: () => Promise<void>
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null)

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext)
  if (!ctx) throw new Error('useWorkspace harus dipakai di dalam WorkspaceProvider')
  return ctx
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<WorkspaceData>(EMPTY)
  const [ready, setReady] = useState(false)
  const [storageError, setStorageError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [profile, setProfile] = useState<Profile | null>(null)
  const [profileLoaded, setProfileLoaded] = useState(false)
  const [hasSeenWelcome, setHasSeenWelcome] = useState(false)
  const [driveConnected, setDriveConnected] = useState(() => isGoogleDriveConnected())
  const [driveEmail, setDriveEmail] = useState<string | null>(() => getConnectedUserEmail())

  const connectDrive = useCallback(async (customClientId?: string) => {
    const res = await connectGoogleDrive(customClientId)
    setDriveConnected(isGoogleDriveConnected())
    setDriveEmail(getConnectedUserEmail())
    return res
  }, [])

  const disconnectDrive = useCallback(() => {
    disconnectGoogleDrive()
    setDriveConnected(false)
    setDriveEmail(null)
  }, [])

  const dataRef = useRef(data)
  dataRef.current = data

  const pendingAnswers = useRef(new Map<string, Answer>())
  const answerTimer = useRef<number | null>(null)
  const idleTimer = useRef<number | null>(null)

  const markSaved = useCallback(() => {
    setSaveState('saved')
    if (idleTimer.current) window.clearTimeout(idleTimer.current)
    idleTimer.current = window.setTimeout(() => setSaveState('idle'), 1800)
  }, [])

  const persist = useCallback(
    async <T,>(store: StoreName, value: T): Promise<boolean> => {
      setSaveState('saving')
      try {
        await putRecord(store, value)
        setSaveError(null)
        markSaved()
        return true
      } catch (error) {
        setSaveError(describeStorageError(error))
        setSaveState('error')
        return false
      }
    },
    [markSaved],
  )

  const persistMany = useCallback(
    async <T,>(store: StoreName, values: T[]): Promise<boolean> => {
      setSaveState('saving')
      try {
        await putMany(store, values)
        setSaveError(null)
        markSaved()
        return true
      } catch (error) {
        setSaveError(describeStorageError(error))
        setSaveState('error')
        return false
      }
    },
    [markSaved],
  )

  const persistDelete = useCallback(
    async (store: StoreName, ids: string[]): Promise<boolean> => {
      setSaveState('saving')
      try {
        await deleteMany(store, ids)
        setSaveError(null)
        markSaved()
        return true
      } catch (error) {
        setSaveError(describeStorageError(error))
        setSaveState('error')
        return false
      }
    },
    [markSaved],
  )

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const storedVersion = await getMeta<number>('schemaVersion')
        if (storedVersion !== null && storedVersion > SCHEMA_VERSION) {
          throw new Error(
            `Data di perangkat ini dibuat dengan versi skema ${storedVersion}, sedangkan aplikasi ini mendukung hingga versi ${SCHEMA_VERSION}. Muat ulang aplikasi versi terbaru agar data tidak rusak.`,
          )
        }
        const loaded = normalizeWorkspace(await loadWorkspace())
        const storedProfile = await getMeta<Profile>('profile')
        const storedWelcome = await getMeta<boolean>('hasSeenWelcome')
        if (storedVersion === null) await setMeta('schemaVersion', SCHEMA_VERSION)
        if (cancelled) return
        setData(loaded)
        setProfile(storedProfile)
        if (storedWelcome) setHasSeenWelcome(true)
      } catch (error) {
        if (!cancelled) {
          setStorageError(describeStorageError(error))
        }
      } finally {
        if (!cancelled) {
          setReady(true)
          setProfileLoaded(true)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const syncProject = useCallback(
    async (id: string): Promise<{ ok: boolean; error?: string }> => {
      const current = dataRef.current.projects.find((p) => p.id === id)
      if (!current) return { ok: false, error: 'Proyek tidak ditemukan.' }

      setData((prev) => ({
        ...prev,
        projects: prev.projects.map((p) => (p.id === id ? { ...p, syncStatus: 'Menyinkronkan' } : p)),
      }))

      try {
        const backupEnvelope = buildProjectBackup(dataRef.current, current)
        const result = await uploadProjectSnapshotToDrive(backupEnvelope, current.remoteFileId)

        if (!result.ok) {
          const updated: Project = {
            ...current,
            syncStatus: 'Gagal menyinkronkan',
            lastSyncError: result.error ?? 'Gagal mengunggah file cadangan ke Google Drive.',
          }
          setData((prev) => ({
            ...prev,
            projects: prev.projects.map((p) => (p.id === id ? updated : p)),
          }))
          await putRecord('projects', updated)
          return { ok: false, error: result.error }
        }

        const timestamp = nowIso()
        const updated: Project = {
          ...current,
          remoteFileId: result.fileId ?? current.remoteFileId,
          lastSyncedAt: timestamp,
          lastSyncedRevision: current.localRevision,
          syncStatus: 'Tersinkron ke Google Drive',
          lastSyncError: null,
        }
        setData((prev) => ({
          ...prev,
          projects: prev.projects.map((p) => (p.id === id ? updated : p)),
        }))
        await putRecord('projects', updated)
        return { ok: true }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Sinkronisasi gagal.'
        const updated: Project = {
          ...current,
          syncStatus: 'Gagal menyinkronkan',
          lastSyncError: errorMsg,
        }
        setData((prev) => ({
          ...prev,
          projects: prev.projects.map((p) => (p.id === id ? updated : p)),
        }))
        await putRecord('projects', updated)
        return { ok: false, error: errorMsg }
      }
    },
    [],
  )

  const deleteCloudBackup = useCallback(
    async (id: string): Promise<{ ok: boolean; error?: string }> => {
      const current = dataRef.current.projects.find((p) => p.id === id)
      if (!current) return { ok: false, error: 'Proyek tidak ditemukan.' }
      if (!current.remoteFileId) return { ok: true }

      const result = await deleteProjectSnapshotFromDrive(current.remoteFileId)
      if (!result.ok) return result

      const updated: Project = {
        ...current,
        remoteFileId: null,
        lastSyncedAt: null,
        lastSyncedRevision: null,
        syncStatus: current.backupEnabled ? 'Menunggu sinkronisasi' : 'Belum dicadangkan',
        lastSyncError: null,
      }
      setData((prev) => ({
        ...prev,
        projects: prev.projects.map((p) => (p.id === id ? updated : p)),
      }))
      await putRecord('projects', updated)
      return { ok: true }
    },
    [],
  )

  const bumpProjectRevision = useCallback(
    async (projectId: string): Promise<void> => {
      const current = dataRef.current.projects.find((p) => p.id === projectId)
      if (!current) return
      const timestamp = nowIso()
      const updated: Project = {
        ...current,
        updatedAt: timestamp,
        localRevision: (current.localRevision ?? 1) + 1,
        syncStatus: current.backupEnabled ? 'Menunggu sinkronisasi' : 'Belum dicadangkan',
      }
      setData((prev) => ({
        ...prev,
        projects: prev.projects.map((p) => (p.id === projectId ? updated : p)),
      }))
      await putRecord('projects', updated)
      if (current.backupEnabled && isGoogleDriveConnected()) {
        void syncProject(projectId)
      }
    },
    [syncProject],
  )

  const flushAnswers = useCallback(async () => {
    if (answerTimer.current) {
      window.clearTimeout(answerTimer.current)
      answerTimer.current = null
    }
    if (pendingAnswers.current.size === 0) return
    const items = [...pendingAnswers.current.values()]
    pendingAnswers.current.clear()
    setSaveState('saving')
    try {
      await putMany('answers', items)
      // Perbarui updatedAt dan localRevision untuk setiap proyek yang jawabannya berubah (PRD 5.8)
      const projectIds = Array.from(new Set(items.map((i) => i.projectId).filter(Boolean)))
      for (const pId of projectIds) {
        await bumpProjectRevision(pId)
      }
      setSaveError(null)
      markSaved()
    } catch (error) {
      for (const item of items) pendingAnswers.current.set(item.id, item)
      setSaveError(describeStorageError(error))
      setSaveState('error')
    }
  }, [markSaved, bumpProjectRevision])

  const retrySave = useCallback(() => {
    void (async () => {
      if (answerTimer.current) {
        window.clearTimeout(answerTimer.current)
        answerTimer.current = null
      }
      setSaveState('saving')
      try {
        // Tulis ulang keadaan saat ini dalam satu transaksi agar semua perubahan
        // yang sempat gagal (jawaban, sesi, impor) ikut tersimpan.
        await replaceWorkspace(dataRef.current)
        pendingAnswers.current.clear()
        setSaveError(null)
        markSaved()
      } catch (error) {
        setSaveError(describeStorageError(error))
        setSaveState('error')
      }
    })()
  }, [markSaved])

  useEffect(() => {
    const handler = () => {
      void flushAnswers()
    }
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') handler()
    }
    window.addEventListener('pagehide', handler)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('pagehide', handler)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [flushAnswers])

  const updateAnswer = useCallback(
    (id: string, patch: Partial<Pick<Answer, 'text' | 'interviewerNotes' | 'status'>>) => {
      const current = dataRef.current.answers.find((a) => a.id === id)
      if (!current) return
      const updated: Answer = { ...current, ...patch, updatedAt: nowIso() }
      setData((prev) => ({ ...prev, answers: prev.answers.map((a) => (a.id === id ? updated : a)) }))
      pendingAnswers.current.set(id, updated)
      setSaveState('saving')
      if (answerTimer.current) window.clearTimeout(answerTimer.current)
      answerTimer.current = window.setTimeout(() => {
        void flushAnswers()
      }, 700)
    },
    [flushAnswers],
  )

  const dismissOnboarding = useCallback(async () => {
    await setMeta('hasSeenWelcome', true)
    setHasSeenWelcome(true)
  }, [])

  const saveProfile = useCallback(async (next: Profile) => {
    await setMeta('profile', next)
    await setMeta('hasSeenWelcome', true)
    setProfile(next)
    setHasSeenWelcome(true)
  }, [])

  const createProject = useCallback<WorkspaceContextValue['createProject']>(
    async (input) => {
      const title = input.title.trim()
      if (!title) return null
      const timestamp = nowIso()
      const backupEnabled = input.backupEnabled ?? false
      const project: Project = {
        id: uid('prj'),
        title,
        description: input.description.trim(),
        objective: input.objective.trim(),
        generalNotes: input.generalNotes.trim(),
        status: 'Persiapan',
        backupEnabled,
        localRevision: 1,
        remoteFileId: null,
        lastSyncedAt: null,
        lastSyncedRevision: null,
        syncStatus: backupEnabled ? 'Menunggu sinkronisasi' : 'Belum dicadangkan',
        lastSyncError: null,
        createdAt: timestamp,
        updatedAt: timestamp,
        lastOpenedAt: null,
      }
      setData((prev) => ({ ...prev, projects: [project, ...prev.projects] }))
      const ok = await persist('projects', project)
      if (!ok) {
        // Jangan biarkan proyek hanya ada di memori saat penulisan gagal.
        setData((prev) => ({ ...prev, projects: prev.projects.filter((item) => item.id !== project.id) }))
        return null
      }
      if (backupEnabled && isGoogleDriveConnected()) {
        void syncProject(project.id)
      }
      return project
    },
    [persist, syncProject],
  )

  const updateProject = useCallback<WorkspaceContextValue['updateProject']>(
    async (id, patch) => {
      const current = dataRef.current.projects.find((p) => p.id === id)
      if (!current) return false
      const updated: Project = {
        ...current,
        ...patch,
        localRevision: (current.localRevision ?? 1) + 1,
        updatedAt: nowIso(),
        syncStatus: current.backupEnabled ? 'Menunggu sinkronisasi' : 'Belum dicadangkan',
      }
      setData((prev) => ({ ...prev, projects: prev.projects.map((p) => (p.id === id ? updated : p)) }))
      const ok = await persist('projects', updated)
      if (!ok) {
        setData((prev) => ({ ...prev, projects: prev.projects.map((p) => (p.id === id ? current : p)) }))
      } else if (current.backupEnabled && isGoogleDriveConnected()) {
        void syncProject(id)
      }
      return ok
    },
    [persist, syncProject],
  )

  const setProjectBackup = useCallback<WorkspaceContextValue['setProjectBackup']>(
    async (id, enabled) => {
      const current = dataRef.current.projects.find((p) => p.id === id)
      if (!current) return false
      const updated: Project = {
        ...current,
        backupEnabled: enabled,
        syncStatus: enabled ? 'Menunggu sinkronisasi' : 'Belum dicadangkan',
        lastSyncError: null,
        localRevision: (current.localRevision ?? 1) + 1,
        updatedAt: nowIso(),
      }
      setData((prev) => ({ ...prev, projects: prev.projects.map((p) => (p.id === id ? updated : p)) }))
      const ok = await persist('projects', updated)
      if (!ok) {
        setData((prev) => ({ ...prev, projects: prev.projects.map((p) => (p.id === id ? current : p)) }))
        return false
      }
      if (enabled && isGoogleDriveConnected()) {
        void syncProject(id)
      }
      return true
    },
    [persist, syncProject],
  )

  const exportProjectBackup = useCallback<WorkspaceContextValue['exportProjectBackup']>((id) => {
    const project = dataRef.current.projects.find((p) => p.id === id)
    if (!project) return false
    const payload = buildProjectBackup(dataRef.current, project)
    downloadJson(suggestBackupFileName(project), payload)
    return true
  }, [])

  const restoreProjectBackup = useCallback<WorkspaceContextValue['restoreProjectBackup']>(
    async (json, mode, targetProjectId) => {
      const parsed = parseProjectBackup(json)
      if (!parsed.ok) return { ok: false, error: parsed.error }

      const current = mode === 'replace' ? dataRef.current.projects.find((p) => p.id === targetProjectId) : undefined
      if (mode === 'replace' && !current) {
        return { ok: false, error: 'Proyek yang akan diganti tidak ditemukan. Muat ulang halaman lalu coba lagi.' }
      }

      let restored: ReturnType<typeof remapProjectBackup>
      try {
        restored = remapProjectBackup(parsed.value, {
          mode,
          targetProjectId,
          currentProject: current,
          existingTitles: dataRef.current.projects.map((project) => project.title),
        })
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : 'Cadangan proyek tidak dapat dipetakan.' }
      }

      const merged: WorkspaceData = { ...dataRef.current }
      if (mode === 'replace' && targetProjectId) {
        for (const key of Object.keys(merged) as Array<keyof WorkspaceData>) {
          if (key === 'projects') continue
          const rows = merged[key] as Array<{ projectId?: string }>
          ;(merged[key] as unknown) = rows.filter((row) => row.projectId !== targetProjectId)
        }
        merged.projects = merged.projects.filter((project) => project.id !== targetProjectId)
      }
      for (const key of Object.keys(restored.data) as Array<keyof WorkspaceData>) {
        ;(merged[key] as unknown) = [
          ...(merged[key] as unknown[]),
          ...(restored.data[key] as unknown[]),
        ]
      }

      setSaveState('saving')
      try {
        // Satu transaksi: jika gagal, data lama tidak tersentuh.
        await replaceWorkspace(merged)
        await setMeta('schemaVersion', SCHEMA_VERSION)
        setData(normalizeWorkspace(merged))
        setSaveError(null)
        markSaved()
        return { ok: true, projectId: restored.project.id }
      } catch (error) {
        setSaveError(describeStorageError(error))
        setSaveState('error')
        return {
          ok: false,
          error: `Pemulihan dibatalkan dan data lama tidak diubah. ${describeStorageError(error)}`,
        }
      }
    },
    [markSaved],
  )

  const setProjectStatus = useCallback<WorkspaceContextValue['setProjectStatus']>(
    async (id, status) => {
      await updateProject(id, { status })
    },
    [updateProject],
  )

  const touchProject = useCallback(
    (id: string) => {
      const current = dataRef.current.projects.find((p) => p.id === id)
      if (!current) return
      const timestamp = nowIso()
      if (current.lastOpenedAt && Date.now() - new Date(current.lastOpenedAt).getTime() < 60_000) return
      const updated = { ...current, lastOpenedAt: timestamp }
      setData((prev) => ({ ...prev, projects: prev.projects.map((p) => (p.id === id ? updated : p)) }))
      void putRecord('projects', updated)
    },
    [],
  )

  const deleteProject = useCallback<WorkspaceContextValue['deleteProject']>(
    async (id) => {
      const d = dataRef.current
      await Promise.all([
        persistDelete('projects', [id]),
        persistDelete('documents', d.documents.filter((x) => x.projectId === id).map((x) => x.id)),
        persistDelete('sections', d.sections.filter((x) => x.projectId === id).map((x) => x.id)),
        persistDelete('questions', d.questions.filter((x) => x.projectId === id).map((x) => x.id)),
        persistDelete('respondents', d.respondents.filter((x) => x.projectId === id).map((x) => x.id)),
        persistDelete('sessions', d.sessions.filter((x) => x.projectId === id).map((x) => x.id)),
        persistDelete('answers', d.answers.filter((x) => x.projectId === id).map((x) => x.id)),
        persistDelete('codes', d.codes.filter((x) => x.projectId === id).map((x) => x.id)),
        persistDelete('answerCodes', d.answerCodes.filter((x) => x.projectId === id).map((x) => x.id)),
        persistDelete('categories', d.categories.filter((x) => x.projectId === id).map((x) => x.id)),
        persistDelete('codeCategories', d.codeCategories.filter((x) => x.projectId === id).map((x) => x.id)),
        persistDelete('themes', d.themes.filter((x) => x.projectId === id).map((x) => x.id)),
        persistDelete('themeCategories', d.themeCategories.filter((x) => x.projectId === id).map((x) => x.id)),
        persistDelete('themeEvidence', d.themeEvidence.filter((x) => x.projectId === id).map((x) => x.id)),
        persistDelete('memos', d.memos.filter((x) => x.projectId === id).map((x) => x.id)),
        persistDelete('exports', d.exports.filter((x) => x.projectId === id).map((x) => x.id)),
      ])
      setData((prev) => {
        const next = { ...prev }
        for (const key of Object.keys(next) as Array<keyof WorkspaceData>) {
          const rows = next[key] as Array<{ id: string; projectId?: string }>
          if (Array.isArray(rows)) {
            ;(next[key] as unknown) = rows.filter((row) => row.projectId !== id)
          }
        }
        next.projects = prev.projects.filter((p) => p.id !== id)
        return next
      })
    },
    [persistDelete],
  )

  const addDocument = useCallback<WorkspaceContextValue['addDocument']>(
    async (doc) => {
      setData((prev) => ({ ...prev, documents: [doc, ...prev.documents] }))
      await persist('documents', doc)
      await bumpProjectRevision(doc.projectId)
    },
    [persist, bumpProjectRevision],
  )

  const deleteDocument = useCallback<WorkspaceContextValue['deleteDocument']>(
    async (id) => {
      const doc = dataRef.current.documents.find((d) => d.id === id)
      const affected = dataRef.current.questions
        .filter((q) => q.sourceDocumentId === id)
        .map((q) => ({ ...q, sourceDocumentId: null }))
      setData((prev) => ({
        ...prev,
        documents: prev.documents.filter((d) => d.id !== id),
        questions: prev.questions.map((q) => (q.sourceDocumentId === id ? { ...q, sourceDocumentId: null } : q)),
      }))
      await persistDelete('documents', [id])
      if (affected.length > 0) await persistMany('questions', affected)
      if (doc) await bumpProjectRevision(doc.projectId)
    },
    [persistDelete, persistMany, bumpProjectRevision],
  )

  const createSection = useCallback<WorkspaceContextValue['createSection']>(
    async (projectId, title, description) => {
      if (!title.trim()) return null
      const projectSections = dataRef.current.sections.filter((s) => s.projectId === projectId)
      const section: Section = {
        id: uid('sec'),
        projectId,
        title: title.trim(),
        description: description.trim(),
        orderIndex: projectSections.length,
      }
      setData((prev) => ({ ...prev, sections: [...prev.sections, section] }))
      await persist('sections', section)
      await bumpProjectRevision(projectId)
      return section
    },
    [persist, bumpProjectRevision],
  )

  const updateSection = useCallback<WorkspaceContextValue['updateSection']>(
    async (id, patch) => {
      const current = dataRef.current.sections.find((s) => s.id === id)
      if (!current) return
      const updated = { ...current, ...patch }
      setData((prev) => ({ ...prev, sections: prev.sections.map((s) => (s.id === id ? updated : s)) }))
      await persist('sections', updated)
      await bumpProjectRevision(current.projectId)
    },
    [persist, bumpProjectRevision],
  )

  const deleteSection = useCallback<WorkspaceContextValue['deleteSection']>(
    async (id) => {
      const sec = dataRef.current.sections.find((s) => s.id === id)
      const questions = dataRef.current.questions.filter((q) => q.sectionId === id)
      const moved = questions.map((q) => ({ ...q, sectionId: null }))
      setData((prev) => ({
        ...prev,
        sections: prev.sections.filter((s) => s.id !== id),
        questions: prev.questions.map((q) => (q.sectionId === id ? { ...q, sectionId: null } : q)),
      }))
      await persistMany('questions', moved)
      await persistDelete('sections', [id])
      if (sec) await bumpProjectRevision(sec.projectId)
    },
    [persistDelete, persistMany, bumpProjectRevision],
  )

  const reorderSections = useCallback<WorkspaceContextValue['reorderSections']>(
    async (projectId, ids) => {
      const updates = dataRef.current.sections
        .filter((s) => s.projectId === projectId)
        .map((s) => ({ ...s, orderIndex: ids.indexOf(s.id) === -1 ? s.orderIndex : ids.indexOf(s.id) }))
      setData((prev) => ({ ...prev, sections: prev.sections.map((s) => updates.find((u) => u.id === s.id) ?? s) }))
      await persistMany('sections', updates)
      await bumpProjectRevision(projectId)
    },
    [persistMany, bumpProjectRevision],
  )

  const createQuestion = useCallback<WorkspaceContextValue['createQuestion']>(
    async (input) => {
      if (!input.text.trim()) return null
      const timestamp = nowIso()
      const question: Question = {
        ...input,
        text: input.text.trim(),
        guidance: input.guidance.trim(),
        id: uid('q'),
        createdAt: timestamp,
        updatedAt: timestamp,
      }
      setData((prev) => ({ ...prev, questions: [...prev.questions, question] }))
      await persist('questions', question)
      await bumpProjectRevision(input.projectId)
      return question
    },
    [persist, bumpProjectRevision],
  )

  const updateQuestion = useCallback<WorkspaceContextValue['updateQuestion']>(
    async (id, patch) => {
      const current = dataRef.current.questions.find((q) => q.id === id)
      if (!current) return
      const updated = { ...current, ...patch, updatedAt: nowIso() }
      setData((prev) => ({ ...prev, questions: prev.questions.map((q) => (q.id === id ? updated : q)) }))
      await persist('questions', updated)
      await bumpProjectRevision(current.projectId)
    },
    [persist, bumpProjectRevision],
  )

  const deleteQuestion = useCallback<WorkspaceContextValue['deleteQuestion']>(
    async (id) => {
      const target = dataRef.current.questions.find((q) => q.id === id)
      const d = dataRef.current
      const answerIds = d.answers.filter((a) => a.questionId === id).map((a) => a.id)
      const evidenceIds = d.themeEvidence.filter((e) => answerIds.includes(e.answerId)).map((e) => e.id)
      const sessions = d.sessions.filter((s) => s.questionIds.includes(id))
      const updatedSessions = sessions.map((s) => ({ ...s, questionIds: s.questionIds.filter((qid) => qid !== id) }))
      setData((prev) => ({
        ...prev,
        questions: prev.questions.filter((q) => q.id !== id),
        answers: prev.answers.filter((a) => a.questionId !== id),
        answerCodes: prev.answerCodes.filter((ac) => !answerIds.includes(ac.answerId)),
        themeEvidence: prev.themeEvidence.filter((te) => !evidenceIds.includes(te.id)),
        sessions: prev.sessions.map((s) => updatedSessions.find((u) => u.id === s.id) ?? s),
      }))
      await persistDelete('questions', [id])
      await Promise.all([
        persistDelete('answers', answerIds),
        persistDelete('answerCodes', d.answerCodes.filter((ac) => answerIds.includes(ac.answerId)).map((ac) => ac.id)),
        persistDelete('themeEvidence', evidenceIds),
        persistMany('sessions', updatedSessions),
      ])
      if (target) await bumpProjectRevision(target.projectId)
    },
    [persistDelete, persistMany, bumpProjectRevision],
  )

  const bulkCreateQuestions = useCallback<WorkspaceContextValue['bulkCreateQuestions']>(
    async (projectId, items, sourceDocumentId) => {
      if (items.length === 0) return 0
      const d = dataRef.current
      let sections = d.sections.filter((s) => s.projectId === projectId)
      const newSections: Section[] = []
      const sectionMap = new Map(sections.map((s) => [s.title.trim().toLowerCase(), s]))
      let maxOrder = d.questions.filter((q) => q.projectId === projectId).reduce((max, q) => Math.max(max, q.orderIndex), -1)
      const timestamp = nowIso()
      const questions: Question[] = []

      for (const item of items) {
        let sectionId: string | null = null
        if (item.sectionTitle && item.sectionTitle.trim()) {
          const key = item.sectionTitle.trim().toLowerCase()
          const existing = sectionMap.get(key)
          if (existing) {
            sectionId = existing.id
          } else {
            const section: Section = {
              id: uid('sec'),
              projectId,
              title: item.sectionTitle.trim(),
              description: '',
              orderIndex: sections.length + newSections.length,
            }
            newSections.push(section)
            sectionMap.set(key, section)
            sectionId = section.id
          }
        }
        maxOrder += 1
        questions.push({
          id: uid('q'),
          projectId,
          sectionId,
          text: item.text.trim(),
          guidance: item.guidance,
          orderIndex: maxOrder,
          isRequired: item.isRequired,
          isActive: true,
          sourceDocumentId,
          createdAt: timestamp,
          updatedAt: timestamp,
        })
      }
      sections = [...sections, ...newSections]
      setData((prev) => ({
        ...prev,
        sections: [...prev.sections, ...newSections],
        questions: [...prev.questions, ...questions],
      }))
      if (newSections.length > 0) await persistMany('sections', newSections)
      await persistMany('questions', questions)
      await bumpProjectRevision(projectId)
      return questions.length
    },
    [persistMany, bumpProjectRevision],
  )

  const reorderQuestions = useCallback<WorkspaceContextValue['reorderQuestions']>(
    async (projectId, orderedIds) => {
      const updates = dataRef.current.questions
        .filter((q) => q.projectId === projectId)
        .map((q) => {
          const index = orderedIds.indexOf(q.id)
          return index === -1 ? q : { ...q, orderIndex: index }
        })
      setData((prev) => ({ ...prev, questions: prev.questions.map((q) => updates.find((u) => u.id === q.id) ?? q) }))
      await persistMany('questions', updates)
      await bumpProjectRevision(projectId)
    },
    [persistMany, bumpProjectRevision],
  )

  const createRespondent = useCallback<WorkspaceContextValue['createRespondent']>(
    async (input) => {
      const code = input.code.trim()
      if (!code) return { ok: false, error: 'Kode narasumber wajib diisi.' }
      if (!/^[A-Za-z0-9._-]{1,20}$/.test(code)) {
        return { ok: false, error: 'Kode hanya boleh berisi huruf, angka, titik, garis bawah, atau tanda hubung (maksimal 20 karakter).' }
      }
      const duplicate = dataRef.current.respondents.some(
        (r) => r.projectId === input.projectId && r.code.toLowerCase() === code.toLowerCase() && !r.archivedAt,
      )
      if (duplicate) return { ok: false, error: `Kode ${code} sudah dipakai pada proyek ini.` }
      const timestamp = nowIso()
      const respondent: Respondent = {
        id: uid('rsp'),
        projectId: input.projectId,
        code,
        displayName: input.displayName.trim(),
        profileNotes: input.profileNotes.trim(),
        createdAt: timestamp,
        updatedAt: timestamp,
        archivedAt: null,
      }
      setData((prev) => ({ ...prev, respondents: [...prev.respondents, respondent] }))
      await persist('respondents', respondent)
      await bumpProjectRevision(input.projectId)
      return { ok: true, respondent }
    },
    [persist, bumpProjectRevision],
  )

  const updateRespondent = useCallback<WorkspaceContextValue['updateRespondent']>(
    async (id, patch) => {
      const current = dataRef.current.respondents.find((r) => r.id === id)
      if (!current) return
      if (patch.code !== undefined) {
        const code = patch.code.trim()
        if (!code) return
        const duplicate = dataRef.current.respondents.some(
          (r) => r.projectId === current.projectId && r.id !== id && r.code.toLowerCase() === code.toLowerCase() && !r.archivedAt,
        )
        if (duplicate) return
        patch = { ...patch, code }
      }
      const updated = { ...current, ...patch, updatedAt: nowIso() }
      setData((prev) => ({ ...prev, respondents: prev.respondents.map((r) => (r.id === id ? updated : r)) }))
      await persist('respondents', updated)
      await bumpProjectRevision(current.projectId)
    },
    [persist, bumpProjectRevision],
  )

  const archiveRespondent = useCallback<WorkspaceContextValue['archiveRespondent']>(
    async (id, archived) => {
      const current = dataRef.current.respondents.find((r) => r.id === id)
      if (!current) return
      const updated = { ...current, archivedAt: archived ? nowIso() : null, updatedAt: nowIso() }
      setData((prev) => ({ ...prev, respondents: prev.respondents.map((r) => (r.id === id ? updated : r)) }))
      await persist('respondents', updated)
      await bumpProjectRevision(current.projectId)
    },
    [persist, bumpProjectRevision],
  )

  const deleteRespondent = useCallback<WorkspaceContextValue['deleteRespondent']>(
    async (id) => {
      const current = dataRef.current.respondents.find((r) => r.id === id)
      const d = dataRef.current
      const sessionIds = d.sessions.filter((s) => s.respondentId === id).map((s) => s.id)
      const answerIds = d.answers.filter((a) => sessionIds.includes(a.sessionId)).map((a) => a.id)
      const evidenceIds = d.themeEvidence.filter((te) => answerIds.includes(te.answerId)).map((te) => te.id)
      setData((prev) => ({
        ...prev,
        respondents: prev.respondents.filter((r) => r.id !== id),
        sessions: prev.sessions.filter((s) => !sessionIds.includes(s.id)),
        answers: prev.answers.filter((a) => !answerIds.includes(a.id)),
        answerCodes: prev.answerCodes.filter((ac) => !answerIds.includes(ac.answerId)),
        themeEvidence: prev.themeEvidence.filter((te) => !evidenceIds.includes(te.id)),
      }))
      await persistDelete('respondents', [id])
      await Promise.all([
        persistDelete('sessions', sessionIds),
        persistDelete('answers', answerIds),
        persistDelete('answerCodes', d.answerCodes.filter((ac) => answerIds.includes(ac.answerId)).map((ac) => ac.id)),
        persistDelete('themeEvidence', evidenceIds),
      ])
      if (current) await bumpProjectRevision(current.projectId)
    },
    [persistDelete, bumpProjectRevision],
  )

  const createSession = useCallback<WorkspaceContextValue['createSession']>(
    async (input) => {
      if (!input.respondentId) return null
      const timestamp = nowIso()
      const questions = dataRef.current.questions
        .filter((q) => q.projectId === input.projectId && q.isActive)
        .sort((a, b) => a.orderIndex - b.orderIndex)
      const session: InterviewSession = {
        id: uid('ses'),
        projectId: input.projectId,
        respondentId: input.respondentId,
        title: input.title.trim() || 'Sesi wawancara',
        interviewDate: input.interviewDate,
        method: input.method,
        interviewerName: input.interviewerName.trim(),
        durationMinutes: input.durationMinutes,
        status: 'Draft',
        notes: input.notes.trim(),
        questionIds: questions.map((q) => q.id),
        createdAt: timestamp,
        updatedAt: timestamp,
      }
      const answers: Answer[] = questions.map((question) => ({
        id: uid('ans'),
        projectId: input.projectId,
        sessionId: session.id,
        questionId: question.id,
        text: '',
        interviewerNotes: '',
        status: 'Belum Dijawab',
        createdAt: timestamp,
        updatedAt: timestamp,
      }))
      setData((prev) => ({ ...prev, sessions: [session, ...prev.sessions], answers: [...prev.answers, ...answers] }))
      await persist('sessions', session)
      await persistMany('answers', answers)
      await bumpProjectRevision(input.projectId)
      return session
    },
    [persist, persistMany, bumpProjectRevision],
  )

  const updateSession = useCallback<WorkspaceContextValue['updateSession']>(
    async (id, patch) => {
      const current = dataRef.current.sessions.find((s) => s.id === id)
      if (!current) return
      const updated = { ...current, ...patch, updatedAt: nowIso() }
      setData((prev) => ({ ...prev, sessions: prev.sessions.map((s) => (s.id === id ? updated : s)) }))
      await persist('sessions', updated)
      await bumpProjectRevision(current.projectId)
    },
    [persist, bumpProjectRevision],
  )

  const deleteSession = useCallback<WorkspaceContextValue['deleteSession']>(
    async (id) => {
      const current = dataRef.current.sessions.find((s) => s.id === id)
      const d = dataRef.current
      const answerIds = d.answers.filter((a) => a.sessionId === id).map((a) => a.id)
      const evidenceIds = d.themeEvidence.filter((te) => answerIds.includes(te.answerId)).map((te) => te.id)
      setData((prev) => ({
        ...prev,
        sessions: prev.sessions.filter((s) => s.id !== id),
        answers: prev.answers.filter((a) => a.sessionId !== id),
        answerCodes: prev.answerCodes.filter((ac) => !answerIds.includes(ac.answerId)),
        themeEvidence: prev.themeEvidence.filter((te) => !evidenceIds.includes(te.id)),
      }))
      await persistDelete('sessions', [id])
      await Promise.all([
        persistDelete('answers', answerIds),
        persistDelete('answerCodes', d.answerCodes.filter((ac) => answerIds.includes(ac.answerId)).map((ac) => ac.id)),
        persistDelete('themeEvidence', evidenceIds),
      ])
      if (current) await bumpProjectRevision(current.projectId)
    },
    [persistDelete, bumpProjectRevision],
  )

  const refreshSessionQuestions = useCallback<WorkspaceContextValue['refreshSessionQuestions']>(
    async (sessionId) => {
      const session = dataRef.current.sessions.find((s) => s.id === sessionId)
      if (!session) return 0
      const active = dataRef.current.questions
        .filter((q) => q.projectId === session.projectId && q.isActive)
        .sort((a, b) => a.orderIndex - b.orderIndex)
      const existingIds = new Set(session.questionIds)
      const newQuestions = active.filter((q) => !existingIds.has(q.id))
      if (newQuestions.length === 0) return 0
      const timestamp = nowIso()
      const updated: InterviewSession = {
        ...session,
        // Pertanyaan yang sudah ada dipertahankan; hanya pertanyaan baru yang ditambahkan.
        questionIds: [...session.questionIds, ...newQuestions.map((q) => q.id)],
        updatedAt: timestamp,
      }
      const answers: Answer[] = newQuestions.map((q) => ({
        id: uid('ans'),
        projectId: session.projectId,
        sessionId,
        questionId: q.id,
        text: '',
        interviewerNotes: '',
        status: 'Belum Dijawab',
        createdAt: timestamp,
        updatedAt: timestamp,
      }))
      setData((prev) => ({
        ...prev,
        sessions: prev.sessions.map((s) => (s.id === sessionId ? updated : s)),
        answers: [...prev.answers, ...answers],
      }))
      await persist('sessions', updated)
      await persistMany('answers', answers)
      await bumpProjectRevision(session.projectId)
      return newQuestions.length
    },
    [persist, persistMany, bumpProjectRevision],
  )

  const createCode = useCallback<WorkspaceContextValue['createCode']>(
    async (projectId, name, description, color) => {
      if (!name.trim()) return null
      const duplicate = dataRef.current.codes.some(
        (c) => c.projectId === projectId && c.name.toLowerCase() === name.trim().toLowerCase(),
      )
      if (duplicate) return null
      const timestamp = nowIso()
      const code: Code = {
        id: uid('code'),
        projectId,
        name: name.trim(),
        description: description.trim(),
        color,
        createdAt: timestamp,
        updatedAt: timestamp,
      }
      setData((prev) => ({ ...prev, codes: [...prev.codes, code] }))
      await persist('codes', code)
      await bumpProjectRevision(projectId)
      return code
    },
    [persist, bumpProjectRevision],
  )

  const updateCode = useCallback<WorkspaceContextValue['updateCode']>(
    async (id, patch) => {
      const current = dataRef.current.codes.find((c) => c.id === id)
      if (!current) return
      const updated = { ...current, ...patch, updatedAt: nowIso() }
      setData((prev) => ({ ...prev, codes: prev.codes.map((c) => (c.id === id ? updated : c)) }))
      await persist('codes', updated)
      await bumpProjectRevision(current.projectId)
    },
    [persist, bumpProjectRevision],
  )

  const deleteCode = useCallback<WorkspaceContextValue['deleteCode']>(
    async (id) => {
      const current = dataRef.current.codes.find((c) => c.id === id)
      const d = dataRef.current
      setData((prev) => ({
        ...prev,
        codes: prev.codes.filter((c) => c.id !== id),
        answerCodes: prev.answerCodes.filter((ac) => ac.codeId !== id),
        codeCategories: prev.codeCategories.filter((cc) => cc.codeId !== id),
      }))
      await persistDelete('codes', [id])
      await Promise.all([
        persistDelete('answerCodes', d.answerCodes.filter((ac) => ac.codeId === id).map((ac) => ac.id)),
        persistDelete('codeCategories', d.codeCategories.filter((cc) => cc.codeId === id).map((cc) => cc.id)),
      ])
      if (current) await bumpProjectRevision(current.projectId)
    },
    [persistDelete, bumpProjectRevision],
  )

  const addAnswerCode = useCallback<WorkspaceContextValue['addAnswerCode']>(
    async (input) => {
      const exists = dataRef.current.answerCodes.some(
        (ac) => ac.answerId === input.answerId && ac.codeId === input.codeId && (ac.excerpt ?? '') === (input.excerpt ?? ''),
      )
      if (exists) return null
      const code: AnswerCode = {
        id: uid('ac'),
        projectId: input.projectId,
        answerId: input.answerId,
        codeId: input.codeId,
        excerpt: input.excerpt,
        note: input.note,
        createdAt: nowIso(),
      }
      setData((prev) => ({ ...prev, answerCodes: [...prev.answerCodes, code] }))
      await persist('answerCodes', code)
      await bumpProjectRevision(input.projectId)
      return code
    },
    [persist, bumpProjectRevision],
  )

  const updateAnswerCode = useCallback<WorkspaceContextValue['updateAnswerCode']>(
    async (id, patch) => {
      const current = dataRef.current.answerCodes.find((ac) => ac.id === id)
      if (!current) return
      const updated = { ...current, ...patch }
      setData((prev) => ({ ...prev, answerCodes: prev.answerCodes.map((ac) => (ac.id === id ? updated : ac)) }))
      await persist('answerCodes', updated)
      await bumpProjectRevision(current.projectId)
    },
    [persist, bumpProjectRevision],
  )

  const deleteAnswerCode = useCallback<WorkspaceContextValue['deleteAnswerCode']>(
    async (id) => {
      const current = dataRef.current.answerCodes.find((ac) => ac.id === id)
      setData((prev) => ({ ...prev, answerCodes: prev.answerCodes.filter((ac) => ac.id !== id) }))
      await persistDelete('answerCodes', [id])
      if (current) await bumpProjectRevision(current.projectId)
    },
    [persistDelete, bumpProjectRevision],
  )

  const createCategory = useCallback<WorkspaceContextValue['createCategory']>(
    async (projectId, name, description) => {
      if (!name.trim()) return null
      const timestamp = nowIso()
      const category: Category = {
        id: uid('cat'),
        projectId,
        name: name.trim(),
        description: description.trim(),
        createdAt: timestamp,
        updatedAt: timestamp,
      }
      setData((prev) => ({ ...prev, categories: [...prev.categories, category] }))
      await persist('categories', category)
      await bumpProjectRevision(projectId)
      return category
    },
    [persist, bumpProjectRevision],
  )

  const updateCategory = useCallback<WorkspaceContextValue['updateCategory']>(
    async (id, patch) => {
      const current = dataRef.current.categories.find((c) => c.id === id)
      if (!current) return
      const updated = { ...current, ...patch, updatedAt: nowIso() }
      setData((prev) => ({ ...prev, categories: prev.categories.map((c) => (c.id === id ? updated : c)) }))
      await persist('categories', updated)
      await bumpProjectRevision(current.projectId)
    },
    [persist, bumpProjectRevision],
  )

  const deleteCategory = useCallback<WorkspaceContextValue['deleteCategory']>(
    async (id) => {
      const current = dataRef.current.categories.find((c) => c.id === id)
      const d = dataRef.current
      setData((prev) => ({
        ...prev,
        categories: prev.categories.filter((c) => c.id !== id),
        codeCategories: prev.codeCategories.filter((cc) => cc.categoryId !== id),
        themeCategories: prev.themeCategories.filter((tc) => tc.categoryId !== id),
      }))
      await persistDelete('categories', [id])
      await Promise.all([
        persistDelete('codeCategories', d.codeCategories.filter((cc) => cc.categoryId === id).map((cc) => cc.id)),
        persistDelete('themeCategories', d.themeCategories.filter((tc) => tc.categoryId === id).map((tc) => tc.id)),
      ])
      if (current) await bumpProjectRevision(current.projectId)
    },
    [persistDelete, bumpProjectRevision],
  )

  const toggleCodeCategory = useCallback<WorkspaceContextValue['toggleCodeCategory']>(
    async (projectId, codeId, categoryId) => {
      const existing = dataRef.current.codeCategories.find((cc) => cc.codeId === codeId && cc.categoryId === categoryId)
      if (existing) {
        setData((prev) => ({ ...prev, codeCategories: prev.codeCategories.filter((cc) => cc.id !== existing.id) }))
        await persistDelete('codeCategories', [existing.id])
        await bumpProjectRevision(projectId)
        return
      }
      const link = { id: uid('cc'), projectId, codeId, categoryId }
      setData((prev) => ({ ...prev, codeCategories: [...prev.codeCategories, link] }))
      await persist('codeCategories', link)
      await bumpProjectRevision(projectId)
    },
    [persist, persistDelete, bumpProjectRevision],
  )

  const createTheme = useCallback<WorkspaceContextValue['createTheme']>(
    async (projectId, name, description, interpretation) => {
      if (!name.trim()) return null
      const timestamp = nowIso()
      const theme: Theme = {
        id: uid('thm'),
        projectId,
        name: name.trim(),
        description: description.trim(),
        interpretation: interpretation.trim(),
        createdAt: timestamp,
        updatedAt: timestamp,
      }
      setData((prev) => ({ ...prev, themes: [...prev.themes, theme] }))
      await persist('themes', theme)
      await bumpProjectRevision(projectId)
      return theme
    },
    [persist, bumpProjectRevision],
  )

  const updateTheme = useCallback<WorkspaceContextValue['updateTheme']>(
    async (id, patch) => {
      const current = dataRef.current.themes.find((t) => t.id === id)
      if (!current) return
      const updated = { ...current, ...patch, updatedAt: nowIso() }
      setData((prev) => ({ ...prev, themes: prev.themes.map((t) => (t.id === id ? updated : t)) }))
      await persist('themes', updated)
      await bumpProjectRevision(current.projectId)
    },
    [persist, bumpProjectRevision],
  )

  const deleteTheme = useCallback<WorkspaceContextValue['deleteTheme']>(
    async (id) => {
      const current = dataRef.current.themes.find((t) => t.id === id)
      const d = dataRef.current
      setData((prev) => ({
        ...prev,
        themes: prev.themes.filter((t) => t.id !== id),
        themeCategories: prev.themeCategories.filter((tc) => tc.themeId !== id),
        themeEvidence: prev.themeEvidence.filter((te) => te.themeId !== id),
        memos: prev.memos.map((m) => (m.themeId === id ? { ...m, themeId: null } : m)),
      }))
      await persistDelete('themes', [id])
      await Promise.all([
        persistDelete('themeCategories', d.themeCategories.filter((tc) => tc.themeId === id).map((tc) => tc.id)),
        persistDelete('themeEvidence', d.themeEvidence.filter((te) => te.themeId === id).map((te) => te.id)),
        persistMany('memos', d.memos.filter((m) => m.themeId === id).map((m) => ({ ...m, themeId: null }))),
      ])
      if (current) await bumpProjectRevision(current.projectId)
    },
    [persistDelete, persistMany, bumpProjectRevision],
  )

  const toggleThemeCategory = useCallback<WorkspaceContextValue['toggleThemeCategory']>(
    async (projectId, themeId, categoryId) => {
      const existing = dataRef.current.themeCategories.find((tc) => tc.themeId === themeId && tc.categoryId === categoryId)
      if (existing) {
        setData((prev) => ({ ...prev, themeCategories: prev.themeCategories.filter((tc) => tc.id !== existing.id) }))
        await persistDelete('themeCategories', [existing.id])
        await bumpProjectRevision(projectId)
        return
      }
      const link = { id: uid('tc'), projectId, themeId, categoryId }
      setData((prev) => ({ ...prev, themeCategories: [...prev.themeCategories, link] }))
      await persist('themeCategories', link)
      await bumpProjectRevision(projectId)
    },
    [persist, persistDelete, bumpProjectRevision],
  )

  const addThemeEvidence = useCallback<WorkspaceContextValue['addThemeEvidence']>(
    async (input) => {
      const exists = dataRef.current.themeEvidence.some((te) => te.themeId === input.themeId && te.answerId === input.answerId)
      if (exists) return null
      const evidence: ThemeEvidence = { id: uid('te'), ...input }
      setData((prev) => ({ ...prev, themeEvidence: [...prev.themeEvidence, evidence] }))
      await persist('themeEvidence', evidence)
      await bumpProjectRevision(input.projectId)
      return evidence
    },
    [persist, bumpProjectRevision],
  )

  const deleteThemeEvidence = useCallback<WorkspaceContextValue['deleteThemeEvidence']>(
    async (id) => {
      const current = dataRef.current.themeEvidence.find((te) => te.id === id)
      setData((prev) => ({ ...prev, themeEvidence: prev.themeEvidence.filter((te) => te.id !== id) }))
      await persistDelete('themeEvidence', [id])
      if (current) await bumpProjectRevision(current.projectId)
    },
    [persistDelete, bumpProjectRevision],
  )

  const createMemo = useCallback<WorkspaceContextValue['createMemo']>(
    async (projectId, themeId, content) => {
      if (!content.trim()) return null
      const memo: AnalysisMemo = { id: uid('memo'), projectId, themeId, content: content.trim(), createdAt: nowIso() }
      setData((prev) => ({ ...prev, memos: [...prev.memos, memo] }))
      await persist('memos', memo)
      await bumpProjectRevision(projectId)
      return memo
    },
    [persist, bumpProjectRevision],
  )

  const deleteMemo = useCallback<WorkspaceContextValue['deleteMemo']>(
    async (id) => {
      const current = dataRef.current.memos.find((m) => m.id === id)
      setData((prev) => ({ ...prev, memos: prev.memos.filter((m) => m.id !== id) }))
      await persistDelete('memos', [id])
      if (current) await bumpProjectRevision(current.projectId)
    },
    [persistDelete, bumpProjectRevision],
  )

  const addExportRecord = useCallback<WorkspaceContextValue['addExportRecord']>(
    async (record) => {
      setData((prev) => ({ ...prev, exports: [record, ...prev.exports] }))
      await persist('exports', record)
      await bumpProjectRevision(record.projectId)
    },
    [persist, bumpProjectRevision],
  )

  const deleteExportRecord = useCallback<WorkspaceContextValue['deleteExportRecord']>(
    async (id) => {
      const current = dataRef.current.exports.find((e) => e.id === id)
      setData((prev) => ({ ...prev, exports: prev.exports.filter((e) => e.id !== id) }))
      await persistDelete('exports', [id])
      if (current) await bumpProjectRevision(current.projectId)
    },
    [persistDelete, bumpProjectRevision],
  )

  const loadDemo = useCallback(async () => {
    const demo = buildDemoWorkspace()
    const merged: WorkspaceData = { ...dataRef.current }
    for (const key of Object.keys(demo) as Array<keyof WorkspaceData>) {
      ;(merged[key] as unknown) = [...(merged[key] as unknown[]), ...(demo[key] as unknown[])]
    }
    setSaveState('saving')
    try {
      // Satu transaksi agar kegagalan tidak menyisakan data contoh setengah masuk.
      await replaceWorkspace(merged)
      setData(normalizeWorkspace(merged))
      setSaveError(null)
      markSaved()
      return demo.projects[0]?.id ?? null
    } catch (error) {
      setSaveError(describeStorageError(error))
      setSaveState('error')
      return null
    }
  }, [markSaved])

  const backupWorkspace = useCallback(() => {
    const payload = buildWorkspaceBackup(dataRef.current, profile)
    downloadJson(`interview-workspace-backup-${new Date().toISOString().slice(0, 10)}.json`, payload)
  }, [profile])

  const restoreWorkspace = useCallback<WorkspaceContextValue['restoreWorkspace']>(async (json) => {
    const parsed = parseWorkspaceBackup(json)
    if (!parsed.ok) return { ok: false, error: parsed.error }

    const restored = normalizeWorkspace(parsed.value.data)
    setSaveState('saving')
    try {
      // replaceWorkspace memakai satu transaksi. Bila gagal, data lama tetap utuh.
      await replaceWorkspace(restored)
      await setMeta('schemaVersion', SCHEMA_VERSION)
      setData(restored)
      if (parsed.value.profile) {
        await setMeta('profile', parsed.value.profile)
        setProfile(parsed.value.profile)
      }
      setSaveError(null)
      markSaved()
      return { ok: true }
    } catch (error) {
      setSaveError(describeStorageError(error))
      setSaveState('error')
      return {
        ok: false,
        error: `Pemulihan dibatalkan dan data lama tidak diubah. ${describeStorageError(error)}`,
      }
    }
  }, [markSaved])

  const resetAll = useCallback(async () => {
    setSaveState('saving')
    try {
      await clearData()
      setData(EMPTY)
      setProfile(null)
      setSaveError(null)
      setSaveState('idle')
    } catch (error) {
      setSaveError(describeStorageError(error))
      setSaveState('error')
      throw error
    }
  }, [])

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      data,
      ready,
      storageError,
      saveError,
      saveState,
      profile,
      profileLoaded,
      hasSeenWelcome,
      dismissOnboarding,
      saveProfile,
      retrySave,
      flushAnswers,
      createProject,
      updateProject,
      setProjectStatus,
      setProjectBackup,
      exportProjectBackup,
      restoreProjectBackup,
      syncProject,
      deleteCloudBackup,
      googleDriveConnected: driveConnected,
      googleAccount: driveEmail,
      connectDrive,
      disconnectDrive,
      touchProject,
      deleteProject,
      addDocument,
      deleteDocument,
      createSection,
      updateSection,
      deleteSection,
      reorderSections,
      createQuestion,
      updateQuestion,
      deleteQuestion,
      bulkCreateQuestions,
      reorderQuestions,
      createRespondent,
      updateRespondent,
      archiveRespondent,
      deleteRespondent,
      createSession,
      updateSession,
      deleteSession,
      refreshSessionQuestions,
      updateAnswer,
      createCode,
      updateCode,
      deleteCode,
      addAnswerCode,
      updateAnswerCode,
      deleteAnswerCode,
      createCategory,
      updateCategory,
      deleteCategory,
      toggleCodeCategory,
      createTheme,
      updateTheme,
      deleteTheme,
      toggleThemeCategory,
      addThemeEvidence,
      deleteThemeEvidence,
      createMemo,
      deleteMemo,
      addExportRecord,
      deleteExportRecord,
      loadDemo,
      backupWorkspace,
      restoreWorkspace,
      resetAll,
    }),
    [
      data,
      ready,
      storageError,
      saveError,
      saveState,
      profile,
      profileLoaded,
      hasSeenWelcome,
      dismissOnboarding,
      saveProfile,
      retrySave,
      flushAnswers,
      createProject,
      updateProject,
      setProjectStatus,
      setProjectBackup,
      exportProjectBackup,
      restoreProjectBackup,
      syncProject,
      deleteCloudBackup,
      driveConnected,
      driveEmail,
      connectDrive,
      disconnectDrive,
      touchProject,
      deleteProject,
      addDocument,
      deleteDocument,
      createSection,
      updateSection,
      deleteSection,
      reorderSections,
      createQuestion,
      updateQuestion,
      deleteQuestion,
      bulkCreateQuestions,
      reorderQuestions,
      createRespondent,
      updateRespondent,
      archiveRespondent,
      deleteRespondent,
      createSession,
      updateSession,
      deleteSession,
      refreshSessionQuestions,
      updateAnswer,
      createCode,
      updateCode,
      deleteCode,
      addAnswerCode,
      updateAnswerCode,
      deleteAnswerCode,
      createCategory,
      updateCategory,
      deleteCategory,
      toggleCodeCategory,
      createTheme,
      updateTheme,
      deleteTheme,
      toggleThemeCategory,
      addThemeEvidence,
      deleteThemeEvidence,
      createMemo,
      deleteMemo,
      addExportRecord,
      deleteExportRecord,
      loadDemo,
      backupWorkspace,
      restoreWorkspace,
      resetAll,
    ],
  )

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
}

// Re-export a helper for computing statuses consistently across the app.
export function isAnswered(answer: Answer): boolean {
  return answer.text.trim().length > 0 && COUNTED_STATUSES.includes(answer.status)
}

export async function readAllRows<T>(store: StoreName): Promise<T[]> {
  return getAll<T>(store as Exclude<StoreName, 'meta'>)
}

export async function removeStoredRecord(store: StoreName, id: string): Promise<void> {
  await deleteRecord(store, id)
}
