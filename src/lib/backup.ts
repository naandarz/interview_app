import type {
  AnalysisMemo,
  Answer,
  AnswerCode,
  Category,
  Code,
  CodeCategory,
  InterviewSession,
  Profile,
  Project,
  Question,
  Respondent,
  Section,
  SourceDocument,
  Theme,
  ThemeCategory,
  ThemeEvidence,
  WorkspaceData,
} from './types'
import { nowIso, slugify, uid } from './utils'

/** Versi skema file backup. Naikkan saat bentuk data berubah dan sediakan migrasi. */
export const SCHEMA_VERSION = 1
export const APP_NAME = 'Interview Workspace'
export const APP_ID = 'interview-workspace'

export interface ProjectBackup {
  app: typeof APP_NAME
  schemaVersion: number
  projectId: string
  exportedAt: string
  localRevision: number
  project: Project
  sourceDocuments: SourceDocument[]
  questionSections: Section[]
  questions: Question[]
  respondents: Respondent[]
  interviewSessions: InterviewSession[]
  answers: Answer[]
  codes: Code[]
  answerCodes: AnswerCode[]
  categories: Category[]
  codeCategories: CodeCategory[]
  themes: Theme[]
  themeCategories: ThemeCategory[]
  themeEvidence: ThemeEvidence[]
  analysisMemos: AnalysisMemo[]
}

export interface WorkspaceBackup {
  app: typeof APP_ID
  schemaVersion: number
  exportedAt: string
  profile: Profile | null
  data: WorkspaceData
}

export interface BackupSummary {
  title: string
  exportedAt: string
  schemaVersion: number
  projectLabel: string
  documents: number
  questions: number
  respondents: number
  sessions: number
  answers: number
  codes: number
  categories: number
  themes: number
}

type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readArray<T>(value: unknown): T[] | null {
  return Array.isArray(value) ? (value as T[]) : null
}

function readVersion(source: Record<string, unknown>): number | null {
  const raw = source.schemaVersion ?? source.version
  return typeof raw === 'number' && Number.isInteger(raw) && raw > 0 ? raw : null
}

function checkApp(source: Record<string, unknown>): string | null {
  const app = source.app
  if (app === APP_NAME || app === APP_ID) return null
  return 'File bukan cadangan Interview Workspace yang valid.'
}

function checkVersion(version: number): string | null {
  if (version > SCHEMA_VERSION) {
    return `File dibuat dengan versi skema ${version}, sedangkan aplikasi ini mendukung hingga versi ${SCHEMA_VERSION}. Perbarui aplikasi sebelum memulihkan file ini.`
  }
  return null
}

const PROJECT_COLLECTION_KEYS = [
  'sourceDocuments',
  'questionSections',
  'questions',
  'respondents',
  'interviewSessions',
  'answers',
  'codes',
  'answerCodes',
  'categories',
  'codeCategories',
  'themes',
  'themeCategories',
  'themeEvidence',
  'analysisMemos',
] as const

type ProjectCollectionKey = (typeof PROJECT_COLLECTION_KEYS)[number]

const ALIASES: Record<ProjectCollectionKey, string[]> = {
  sourceDocuments: ['sourceDocuments', 'documents'],
  questionSections: ['questionSections', 'sections'],
  questions: ['questions'],
  respondents: ['respondents'],
  interviewSessions: ['interviewSessions', 'sessions'],
  answers: ['answers'],
  codes: ['codes'],
  answerCodes: ['answerCodes'],
  categories: ['categories'],
  codeCategories: ['codeCategories'],
  themes: ['themes'],
  themeCategories: ['themeCategories'],
  themeEvidence: ['themeEvidence'],
  analysisMemos: ['analysisMemos', 'memos'],
}

function readCollection(source: Record<string, unknown>, key: ProjectCollectionKey): unknown[] | null {
  for (const alias of ALIASES[key]) {
    const value = source[alias]
    if (Array.isArray(value)) return value
  }
  return null
}

const WORKSPACE_KEYS: Array<keyof WorkspaceData> = [
  'projects',
  'documents',
  'sections',
  'questions',
  'respondents',
  'sessions',
  'answers',
  'codes',
  'answerCodes',
  'categories',
  'codeCategories',
  'themes',
  'themeCategories',
  'themeEvidence',
  'memos',
  'exports',
]

function normalizeProject(raw: Project): Project {
  return {
    ...raw,
    backupEnabled: raw.backupEnabled ?? false,
    localRevision: typeof raw.localRevision === 'number' && raw.localRevision > 0 ? raw.localRevision : 1,
    syncStatus: raw.syncStatus ?? 'Belum dicadangkan',
    lastSyncedAt: raw.lastSyncedAt ?? null,
    remoteFileId: raw.remoteFileId ?? null,
    lastSyncedRevision: raw.lastSyncedRevision ?? null,
    lastSyncError: raw.lastSyncError ?? null,
  }
}

function idsOf(rows: Array<{ id: string }>): Set<string> {
  return new Set(rows.map((row) => row.id))
}

function findDuplicateId(rows: Array<{ id: string }>): string | null {
  const seen = new Set<string>()
  for (const row of rows) {
    if (!row || typeof row.id !== 'string' || !row.id) return 'Baris data tanpa ID yang valid ditemukan.'
    if (seen.has(row.id)) return `ID ganda ditemukan pada cadangan: ${row.id}`
    seen.add(row.id)
  }
  return null
}

function validateReferences(data: WorkspaceData, projectId?: string): string | null {
  const projects = projectId ? data.projects.filter((project) => project.id === projectId) : data.projects
  const projectIds = idsOf(projects)
  const documents = new Set(data.documents.map((row) => row.id))
  const sections = new Set(data.sections.map((row) => row.id))
  const questions = new Set(data.questions.map((row) => row.id))
  const respondents = new Set(data.respondents.map((row) => row.id))
  const sessions = new Set(data.sessions.map((row) => row.id))
  const answers = new Set(data.answers.map((row) => row.id))
  const codes = new Set(data.codes.map((row) => row.id))
  const categories = new Set(data.categories.map((row) => row.id))
  const themes = new Set(data.themes.map((row) => row.id))

  for (const collection of [data.documents, data.sections, data.questions, data.respondents, data.sessions, data.answers, data.codes, data.answerCodes, data.categories, data.codeCategories, data.themes, data.themeCategories, data.themeEvidence, data.memos]) {
    for (const row of collection) {
      if (!projectIds.has(row.projectId)) {
        return `Data ${row.id} merujuk proyek yang tidak ada pada cadangan.`
      }
    }
  }

  for (const question of data.questions) {
    if (question.sectionId && !sections.has(question.sectionId)) return `Pertanyaan ${question.id} merujuk bagian yang tidak ada.`
    if (question.sourceDocumentId && !documents.has(question.sourceDocumentId)) return `Pertanyaan ${question.id} merujuk dokumen yang tidak ada.`
  }
  for (const session of data.sessions) {
    if (!respondents.has(session.respondentId)) return `Sesi ${session.id} merujuk narasumber yang tidak ada.`
    if (!Array.isArray(session.questionIds)) return `Sesi ${session.id} tidak memiliki daftar pertanyaan yang valid.`
    for (const questionId of session.questionIds) {
      if (!questions.has(questionId)) return `Sesi ${session.id} merujuk pertanyaan yang tidak ada.`
    }
  }
  const answerPairs = new Set<string>()
  for (const answer of data.answers) {
    if (!sessions.has(answer.sessionId)) return `Jawaban ${answer.id} merujuk sesi yang tidak ada.`
    if (!questions.has(answer.questionId)) return `Jawaban ${answer.id} merujuk pertanyaan yang tidak ada.`
    const pair = `${answer.sessionId}::${answer.questionId}`
    if (answerPairs.has(pair)) return `Ada lebih dari satu jawaban untuk pertanyaan yang sama dalam satu sesi (${answer.id}).`
    answerPairs.add(pair)
  }
  for (const link of data.answerCodes) {
    if (!answers.has(link.answerId)) return `Coding ${link.id} merujuk jawaban yang tidak ada.`
    if (!codes.has(link.codeId)) return `Coding ${link.id} merujuk kode yang tidak ada.`
  }
  for (const link of data.codeCategories) {
    if (!codes.has(link.codeId)) return `Relasi kode-kategori ${link.id} merujuk kode yang tidak ada.`
    if (!categories.has(link.categoryId)) return `Relasi kode-kategori ${link.id} merujuk kategori yang tidak ada.`
  }
  for (const link of data.themeCategories) {
    if (!themes.has(link.themeId)) return `Relasi tema-kategori ${link.id} merujuk tema yang tidak ada.`
    if (!categories.has(link.categoryId)) return `Relasi tema-kategori ${link.id} merujuk kategori yang tidak ada.`
  }
  for (const evidence of data.themeEvidence) {
    if (!themes.has(evidence.themeId)) return `Bukti tema ${evidence.id} merujuk tema yang tidak ada.`
    if (!answers.has(evidence.answerId)) return `Bukti tema ${evidence.id} merujuk jawaban yang tidak ada.`
  }
  for (const memo of data.memos) {
    if (memo.themeId && !themes.has(memo.themeId)) return `Memo ${memo.id} merujuk tema yang tidak ada.`
  }
  return null
}

export function buildProjectBackup(data: WorkspaceData, project: Project): ProjectBackup {
  const scoped = <T extends { projectId: string }>(rows: T[]): T[] => rows.filter((row) => row.projectId === project.id)
  return {
    app: APP_NAME,
    schemaVersion: SCHEMA_VERSION,
    projectId: project.id,
    exportedAt: nowIso(),
    localRevision: project.localRevision ?? 1,
    project: normalizeProject(project),
    sourceDocuments: scoped(data.documents),
    questionSections: scoped(data.sections),
    questions: scoped(data.questions),
    respondents: scoped(data.respondents),
    interviewSessions: scoped(data.sessions),
    answers: scoped(data.answers),
    codes: scoped(data.codes),
    answerCodes: scoped(data.answerCodes),
    categories: scoped(data.categories),
    codeCategories: scoped(data.codeCategories),
    themes: scoped(data.themes),
    themeCategories: scoped(data.themeCategories),
    themeEvidence: scoped(data.themeEvidence),
    analysisMemos: scoped(data.memos),
  }
}

export function buildWorkspaceBackup(data: WorkspaceData, profile: Profile | null): WorkspaceBackup {
  return {
    app: APP_ID,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: nowIso(),
    profile,
    data,
  }
}

export function parseProjectBackup(json: string): ParseResult<ProjectBackup> {
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    return { ok: false, error: 'File JSON tidak dapat dibaca. Pastikan file cadangan tidak rusak.' }
  }
  if (!isRecord(parsed)) return { ok: false, error: 'Isi file bukan objek JSON yang valid.' }

  const appError = checkApp(parsed)
  if (appError) return { ok: false, error: appError }

  const version = readVersion(parsed)
  if (!version) return { ok: false, error: 'File tidak memiliki schemaVersion yang valid. Gunakan file backup proyek dari aplikasi ini.' }
  const versionError = checkVersion(version)
  if (versionError) return { ok: false, error: versionError }

  const project = parsed.project
  if (!isRecord(project) || typeof project.id !== 'string' || typeof project.title !== 'string') {
    return { ok: false, error: 'Struktur proyek pada cadangan tidak valid.' }
  }
  if (typeof parsed.projectId === 'string' && parsed.projectId !== project.id) {
    return { ok: false, error: 'projectId pada envelope tidak cocok dengan ID proyek di dalam file.' }
  }

  const collections: Partial<Record<ProjectCollectionKey, unknown[]>> = {}
  for (const key of PROJECT_COLLECTION_KEYS) {
    const rows = readCollection(parsed, key)
    if (!rows) return { ok: false, error: `Bagian data "${key}" tidak ditemukan pada cadangan.` }
    collections[key] = rows
  }

  const normalizedProject = normalizeProject(project as unknown as Project)
  const backup: ProjectBackup = {
    app: APP_NAME,
    schemaVersion: version,
    projectId: normalizedProject.id,
    exportedAt: typeof parsed.exportedAt === 'string' ? parsed.exportedAt : nowIso(),
    localRevision: typeof parsed.localRevision === 'number' ? parsed.localRevision : normalizedProject.localRevision,
    project: normalizedProject,
    sourceDocuments: collections.sourceDocuments as SourceDocument[],
    questionSections: collections.questionSections as Section[],
    questions: collections.questions as Question[],
    respondents: collections.respondents as Respondent[],
    interviewSessions: collections.interviewSessions as InterviewSession[],
    answers: collections.answers as Answer[],
    codes: collections.codes as Code[],
    answerCodes: collections.answerCodes as AnswerCode[],
    categories: collections.categories as Category[],
    codeCategories: collections.codeCategories as CodeCategory[],
    themes: collections.themes as Theme[],
    themeCategories: collections.themeCategories as ThemeCategory[],
    themeEvidence: collections.themeEvidence as ThemeEvidence[],
    analysisMemos: collections.analysisMemos as AnalysisMemo[],
  }

  const rowsForDuplicateCheck: Array<Array<{ id: string }>> = [
    backup.sourceDocuments,
    backup.questionSections,
    backup.questions,
    backup.respondents,
    backup.interviewSessions,
    backup.answers,
    backup.codes,
    backup.answerCodes,
    backup.categories,
    backup.codeCategories,
    backup.themes,
    backup.themeCategories,
    backup.themeEvidence,
    backup.analysisMemos,
  ]
  for (const rows of rowsForDuplicateCheck) {
    const duplicate = findDuplicateId(rows)
    if (duplicate) return { ok: false, error: duplicate }
  }

  const referenceError = (() => {
    try {
      return validateReferences(dataFromProjectBackup(backup))
    } catch {
      return 'Struktur data pada cadangan tidak valid atau tidak lengkap.'
    }
  })()
  if (referenceError) return { ok: false, error: referenceError }

  return { ok: true, value: backup }
}

export function parseWorkspaceBackup(json: string): ParseResult<WorkspaceBackup> {
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    return { ok: false, error: 'File JSON tidak dapat dibaca. Pastikan file cadangan tidak rusak.' }
  }
  if (!isRecord(parsed)) return { ok: false, error: 'Isi file bukan objek JSON yang valid.' }

  const appError = checkApp(parsed)
  if (appError) return { ok: false, error: appError }

  const version = readVersion(parsed)
  if (!version) return { ok: false, error: 'File tidak memiliki schemaVersion yang valid.' }
  const versionError = checkVersion(version)
  if (versionError) return { ok: false, error: versionError }

  if (!isRecord(parsed.data)) return { ok: false, error: 'Bagian data cadangan tidak ditemukan.' }

  const data = { ...(parsed.data as unknown as WorkspaceData) }
  for (const key of WORKSPACE_KEYS) {
    const rows = readArray<{ id: string }>(data[key])
    if (!rows) return { ok: false, error: `Bagian data "${key}" tidak ditemukan pada cadangan.` }
    const duplicate = findDuplicateId(rows)
    if (duplicate) return { ok: false, error: duplicate }
    ;(data[key] as unknown) = rows
  }
  data.projects = data.projects.map(normalizeProject)

  const referenceError = (() => {
    try {
      return validateReferences(data)
    } catch {
      return 'Struktur data pada cadangan tidak valid atau tidak lengkap.'
    }
  })()
  if (referenceError) return { ok: false, error: referenceError }

  const profileValue = parsed.profile
  const profile = isRecord(profileValue)
    ? {
        name: typeof profileValue.name === 'string' ? profileValue.name : '',
        email: typeof profileValue.email === 'string' ? profileValue.email : '',
        institution: typeof profileValue.institution === 'string' ? profileValue.institution : '',
      }
    : null

  return {
    ok: true,
    value: {
      app: APP_ID,
      schemaVersion: version,
      exportedAt: typeof parsed.exportedAt === 'string' ? parsed.exportedAt : nowIso(),
      profile,
      data,
    },
  }
}

export function summarizeProjectBackup(backup: ProjectBackup): BackupSummary {
  return {
    title: backup.project.title,
    exportedAt: backup.exportedAt,
    schemaVersion: backup.schemaVersion,
    projectLabel: backup.project.status,
    documents: backup.sourceDocuments.length,
    questions: backup.questions.length,
    respondents: backup.respondents.length,
    sessions: backup.interviewSessions.length,
    answers: backup.answers.filter((answer) => answer.text.trim().length > 0).length,
    codes: backup.codes.length,
    categories: backup.categories.length,
    themes: backup.themes.length,
  }
}

export function dataFromProjectBackup(backup: ProjectBackup): WorkspaceData {
  return {
    projects: [backup.project],
    documents: backup.sourceDocuments,
    sections: backup.questionSections,
    questions: backup.questions,
    respondents: backup.respondents,
    sessions: backup.interviewSessions,
    answers: backup.answers,
    codes: backup.codes,
    answerCodes: backup.answerCodes,
    categories: backup.categories,
    codeCategories: backup.codeCategories,
    themes: backup.themes,
    themeCategories: backup.themeCategories,
    themeEvidence: backup.themeEvidence,
    memos: backup.analysisMemos,
    exports: [],
  }
}

/**
 * Membuat salinan dengan ID baru dan memetakan seluruh relasi internal.
 * Dipakai untuk "pulihkan sebagai proyek baru" maupun "ganti proyek terpilih".
 */
export function remapProjectBackup(
  backup: ProjectBackup,
  options: { mode: 'new' | 'replace'; targetProjectId?: string; currentProject?: Project; existingTitles?: string[] },
): { project: Project; data: WorkspaceData } {
  if (options.mode === 'replace' && !options.targetProjectId) {
    throw new Error('ID proyek target wajib diisi untuk mode ganti proyek.')
  }

  const newProjectId = options.mode === 'new' ? uid('prj') : (options.targetProjectId as string)
  const idMap = new Map<string, string>()
  const assign = (oldId: string, prefix: string): string => {
    const existing = idMap.get(oldId)
    if (existing) return existing
    const next = uid(prefix)
    idMap.set(oldId, next)
    return next
  }

  backup.sourceDocuments.forEach((row) => assign(row.id, 'doc'))
  backup.questionSections.forEach((row) => assign(row.id, 'sec'))
  backup.questions.forEach((row) => assign(row.id, 'q'))
  backup.respondents.forEach((row) => assign(row.id, 'rsp'))
  backup.interviewSessions.forEach((row) => assign(row.id, 'ses'))
  backup.answers.forEach((row) => assign(row.id, 'ans'))
  backup.codes.forEach((row) => assign(row.id, 'code'))
  backup.answerCodes.forEach((row) => assign(row.id, 'ac'))
  backup.categories.forEach((row) => assign(row.id, 'cat'))
  backup.codeCategories.forEach((row) => assign(row.id, 'cc'))
  backup.themes.forEach((row) => assign(row.id, 'thm'))
  backup.themeCategories.forEach((row) => assign(row.id, 'tc'))
  backup.themeEvidence.forEach((row) => assign(row.id, 'te'))
  backup.analysisMemos.forEach((row) => assign(row.id, 'memo'))

  const mapId = (oldId: string | null | undefined): string | null => {
    if (!oldId) return null
    return idMap.get(oldId) ?? null
  }

  const now = nowIso()
  const timestamp = backup.exportedAt || now
  const current = options.currentProject
  const titleConflict =
    options.mode === 'new' &&
    options.existingTitles?.some((title) => title.trim().toLowerCase() === backup.project.title.trim().toLowerCase())

  const project: Project = {
    ...normalizeProject(backup.project),
    id: newProjectId,
    title: titleConflict ? `${backup.project.title} (pulihan)` : backup.project.title,
    createdAt: options.mode === 'replace' ? (current?.createdAt ?? backup.project.createdAt) : backup.project.createdAt || timestamp,
    updatedAt: now,
    lastOpenedAt: null,
    backupEnabled: options.mode === 'replace' ? (current?.backupEnabled ?? false) : backup.project.backupEnabled,
    localRevision: options.mode === 'replace' ? (current?.localRevision ?? 1) + 1 : Math.max(1, backup.project.localRevision ?? 1),
    remoteFileId: options.mode === 'replace' ? (current?.remoteFileId ?? null) : null,
    lastSyncedAt: options.mode === 'replace' ? (current?.lastSyncedAt ?? null) : null,
    lastSyncedRevision: options.mode === 'replace' ? (current?.lastSyncedRevision ?? null) : null,
    syncStatus: options.mode === 'replace' ? (current?.syncStatus ?? 'Belum dicadangkan') : 'Belum dicadangkan',
    lastSyncError: null,
  }

  const data: WorkspaceData = {
    projects: [project],
    documents: backup.sourceDocuments.map((row) => ({
      ...row,
      id: mapId(row.id) as string,
      projectId: newProjectId,
    })),
    sections: backup.questionSections.map((row) => ({
      ...row,
      id: mapId(row.id) as string,
      projectId: newProjectId,
    })),
    questions: backup.questions.map((row) => ({
      ...row,
      id: mapId(row.id) as string,
      projectId: newProjectId,
      sectionId: mapId(row.sectionId),
      sourceDocumentId: mapId(row.sourceDocumentId),
    })),
    respondents: backup.respondents.map((row) => ({
      ...row,
      id: mapId(row.id) as string,
      projectId: newProjectId,
    })),
    sessions: backup.interviewSessions.map((row) => ({
      ...row,
      id: mapId(row.id) as string,
      projectId: newProjectId,
      respondentId: mapId(row.respondentId) as string,
      questionIds: row.questionIds.map((questionId) => mapId(questionId) as string),
    })),
    answers: backup.answers.map((row) => ({
      ...row,
      id: mapId(row.id) as string,
      projectId: newProjectId,
      sessionId: mapId(row.sessionId) as string,
      questionId: mapId(row.questionId) as string,
    })),
    codes: backup.codes.map((row) => ({
      ...row,
      id: mapId(row.id) as string,
      projectId: newProjectId,
    })),
    answerCodes: backup.answerCodes.map((row) => ({
      ...row,
      id: mapId(row.id) as string,
      projectId: newProjectId,
      answerId: mapId(row.answerId) as string,
      codeId: mapId(row.codeId) as string,
    })),
    categories: backup.categories.map((row) => ({
      ...row,
      id: mapId(row.id) as string,
      projectId: newProjectId,
    })),
    codeCategories: backup.codeCategories.map((row) => ({
      ...row,
      id: mapId(row.id) as string,
      projectId: newProjectId,
      codeId: mapId(row.codeId) as string,
      categoryId: mapId(row.categoryId) as string,
    })),
    themes: backup.themes.map((row) => ({
      ...row,
      id: mapId(row.id) as string,
      projectId: newProjectId,
    })),
    themeCategories: backup.themeCategories.map((row) => ({
      ...row,
      id: mapId(row.id) as string,
      projectId: newProjectId,
      themeId: mapId(row.themeId) as string,
      categoryId: mapId(row.categoryId) as string,
    })),
    themeEvidence: backup.themeEvidence.map((row) => ({
      ...row,
      id: mapId(row.id) as string,
      projectId: newProjectId,
      themeId: mapId(row.themeId) as string,
      answerId: mapId(row.answerId) as string,
    })),
    memos: backup.analysisMemos.map((row) => ({
      ...row,
      id: mapId(row.id) as string,
      projectId: newProjectId,
      themeId: mapId(row.themeId),
    })),
    exports: [],
  }

  return { project, data }
}

export function suggestBackupFileName(project: Project): string {
  return `interview-workspace-${slugify(project.title) || 'proyek'}-${new Date().toISOString().slice(0, 10)}.json`
}

export function downloadJson(fileName: string, payload: unknown): void {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}
