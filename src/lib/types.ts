export type ProjectStatus = 'Persiapan' | 'Berlangsung' | 'Analisis' | 'Selesai' | 'Diarsipkan'
export type SessionStatus = 'Draft' | 'Berlangsung' | 'Perlu Ditinjau' | 'Selesai' | 'Diarsipkan'
export type AnswerStatus = 'Belum Dijawab' | 'Terisi' | 'Perlu Klarifikasi' | 'Ditinjau'
export type InterviewMethod = 'Tatap muka' | 'Daring' | 'Telepon' | 'Lainnya'
export type ExtractionStatus = 'Berhasil' | 'Gagal' | 'Tidak terbaca'

/** Status pencadangan cloud dipisahkan dari status simpan lokal. */
export type BackupStatus =
  | 'Belum dicadangkan'
  | 'Menunggu sinkronisasi'
  | 'Menyinkronkan'
  | 'Tersinkron ke Google Drive'
  | 'Konflik'
  | 'Perlu menghubungkan ulang'
  | 'Gagal menyinkronkan'

export interface Project {
  id: string
  title: string
  description: string
  objective: string
  generalNotes: string
  status: ProjectStatus
  /** Preferensi pengguna. Default OFF agar tidak ada data yang dikirim tanpa pilihan. */
  backupEnabled: boolean
  /** Dinaikkan setiap perubahan konten proyek; dipakai untuk membandingkan salinan backup. */
  localRevision: number
  /** Metadata sinkronisasi opsional (disiapkan untuk integrasi Google Drive). */
  remoteFileId?: string | null
  lastSyncedAt?: string | null
  lastSyncedRevision?: number | null
  syncStatus?: BackupStatus
  lastSyncError?: string | null
  createdAt: string
  updatedAt: string
  lastOpenedAt: string | null
}

export interface SourceDocument {
  id: string
  projectId: string
  fileName: string
  fileType: string
  fileSize: number
  uploadedAt: string
  extractionStatus: ExtractionStatus
  extractionError: string | null
  charCount: number
  textPreview: string
  /** Teks hasil ekstraksi, disimpan terpisah dari pertanyaan yang sudah dikonfirmasi. */
  extractedText?: string
  /** True bila teks melebihi batas simpan dan dipotong. */
  truncated?: boolean
}

export interface Section {
  id: string
  projectId: string
  title: string
  description: string
  orderIndex: number
}

export interface Question {
  id: string
  projectId: string
  sectionId: string | null
  text: string
  guidance: string
  orderIndex: number
  isRequired: boolean
  isActive: boolean
  sourceDocumentId: string | null
  createdAt: string
  updatedAt: string
}

export interface Respondent {
  id: string
  projectId: string
  code: string
  displayName: string
  profileNotes: string
  createdAt: string
  updatedAt: string
  archivedAt: string | null
}

export interface InterviewSession {
  id: string
  projectId: string
  respondentId: string
  title: string
  interviewDate: string
  method: InterviewMethod
  interviewerName: string
  durationMinutes: number | null
  status: SessionStatus
  notes: string
  questionIds: string[]
  createdAt: string
  updatedAt: string
}

export interface Answer {
  id: string
  projectId: string
  sessionId: string
  questionId: string
  text: string
  interviewerNotes: string
  status: AnswerStatus
  createdAt: string
  updatedAt: string
}

export interface Code {
  id: string
  projectId: string
  name: string
  description: string
  color: string
  createdAt: string
  updatedAt: string
}

export interface AnswerCode {
  id: string
  projectId: string
  answerId: string
  codeId: string
  excerpt: string | null
  note: string
  createdAt: string
}

export interface Category {
  id: string
  projectId: string
  name: string
  description: string
  createdAt: string
  updatedAt: string
}

export interface CodeCategory {
  id: string
  projectId: string
  codeId: string
  categoryId: string
}

export interface Theme {
  id: string
  projectId: string
  name: string
  description: string
  interpretation: string
  createdAt: string
  updatedAt: string
}

export interface ThemeCategory {
  id: string
  projectId: string
  themeId: string
  categoryId: string
}

export interface ThemeEvidence {
  id: string
  projectId: string
  themeId: string
  answerId: string
  excerpt: string
  note: string
}

export interface AnalysisMemo {
  id: string
  projectId: string
  themeId: string | null
  content: string
  createdAt: string
}

export interface ExportRecord {
  id: string
  projectId: string
  type: string
  format: string
  scopeLabel: string
  anonymized: boolean
  fileName: string
  createdAt: string
}

export interface Profile {
  name: string
  email: string
  institution: string
}

export interface WorkspaceData {
  projects: Project[]
  documents: SourceDocument[]
  sections: Section[]
  questions: Question[]
  respondents: Respondent[]
  sessions: InterviewSession[]
  answers: Answer[]
  codes: Code[]
  answerCodes: AnswerCode[]
  categories: Category[]
  codeCategories: CodeCategory[]
  themes: Theme[]
  themeCategories: ThemeCategory[]
  themeEvidence: ThemeEvidence[]
  memos: AnalysisMemo[]
  exports: ExportRecord[]
}

export const ANSWER_STATUSES: AnswerStatus[] = [
  'Belum Dijawab',
  'Terisi',
  'Perlu Klarifikasi',
  'Ditinjau',
]

export const COUNTED_STATUSES: AnswerStatus[] = ['Terisi', 'Perlu Klarifikasi', 'Ditinjau']

export const PROJECT_STATUSES: ProjectStatus[] = [
  'Persiapan',
  'Berlangsung',
  'Analisis',
  'Selesai',
  'Diarsipkan',
]

export const SESSION_STATUSES: SessionStatus[] = [
  'Draft',
  'Berlangsung',
  'Perlu Ditinjau',
  'Selesai',
  'Diarsipkan',
]

export const METHODS: InterviewMethod[] = ['Tatap muka', 'Daring', 'Telepon', 'Lainnya']
