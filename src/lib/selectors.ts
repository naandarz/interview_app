import type {
  Answer,
  AnswerCode,
  AnswerStatus,
  Category,
  Code,
  InterviewSession,
  Project,
  Question,
  Respondent,
  Section,
  Theme,
  WorkspaceData,
} from './types'
import { COUNTED_STATUSES } from './types'

export interface SessionProgress {
  answered: number
  total: number
  percent: number
}

export function answersForSession(data: WorkspaceData, sessionId: string): Answer[] {
  return data.answers.filter((a) => a.sessionId === sessionId)
}

export function answerFor(data: WorkspaceData, sessionId: string, questionId: string): Answer | undefined {
  return data.answers.find((a) => a.sessionId === sessionId && a.questionId === questionId)
}

export function sessionProgress(data: WorkspaceData, session: InterviewSession): SessionProgress {
  const questionIds = new Set(session.questionIds)
  const answeredIds = new Set(
    data.answers
      .filter(
        (a) =>
          a.sessionId === session.id &&
          questionIds.has(a.questionId) &&
          a.text.trim().length > 0 &&
          COUNTED_STATUSES.includes(a.status),
      )
      .map((a) => a.questionId),
  )
  const total = questionIds.size
  const answered = answeredIds.size
  const percent = total === 0 ? 0 : Math.min(100, Math.round((answered / total) * 100))
  return { answered, total, percent }
}

export function sessionAnsweredCount(data: WorkspaceData, sessionId: string): number {
  return data.answers.filter(
    (a) => a.sessionId === sessionId && a.text.trim().length > 0 && COUNTED_STATUSES.includes(a.status),
  ).length
}

export function projectQuestions(data: WorkspaceData, projectId: string, includeInactive = false): Question[] {
  return data.questions
    .filter((q) => q.projectId === projectId && (includeInactive || q.isActive))
    .sort((a, b) => a.orderIndex - b.orderIndex)
}

export function projectSections(data: WorkspaceData, projectId: string): Section[] {
  return data.sections.filter((s) => s.projectId === projectId).sort((a, b) => a.orderIndex - b.orderIndex)
}

export function projectRespondents(data: WorkspaceData, projectId: string, includeArchived = false): Respondent[] {
  return data.respondents
    .filter((r) => r.projectId === projectId && (includeArchived || !r.archivedAt))
    .sort((a, b) => a.code.localeCompare(b.code))
}

export function projectSessions(data: WorkspaceData, projectId: string, includeArchived = false): InterviewSession[] {
  return data.sessions
    .filter((s) => s.projectId === projectId && (includeArchived || s.status !== 'Diarsipkan'))
    .sort((a, b) => new Date(b.interviewDate).getTime() - new Date(a.interviewDate).getTime())
}

export function projectAnswers(data: WorkspaceData, projectId: string): Answer[] {
  return data.answers.filter((a) => a.projectId === projectId)
}

export function respondentSessions(data: WorkspaceData, respondentId: string): InterviewSession[] {
  return data.sessions
    .filter((s) => s.respondentId === respondentId && s.status !== 'Diarsipkan')
    .sort((a, b) => new Date(b.interviewDate).getTime() - new Date(a.interviewDate).getTime())
}

export function respondentAnswerCount(data: WorkspaceData, respondentId: string): number {
  const sessionIds = new Set(data.sessions.filter((s) => s.respondentId === respondentId).map((s) => s.id))
  return data.answers.filter((a) => sessionIds.has(a.sessionId) && a.text.trim().length > 0).length
}

export function questionAnswerCount(data: WorkspaceData, questionId: string): number {
  return data.answers.filter((a) => a.questionId === questionId && a.text.trim().length > 0).length
}

export function questionSessionsAnswered(data: WorkspaceData, questionId: string): number {
  return data.answers.filter((a) => a.questionId === questionId && a.text.trim().length > 0).length
}

export function sessionRespondent(data: WorkspaceData, session: InterviewSession): Respondent | undefined {
  return data.respondents.find((r) => r.id === session.respondentId)
}

export function questionById(data: WorkspaceData, id: string): Question | undefined {
  return data.questions.find((q) => q.id === id)
}

export function sectionById(data: WorkspaceData, id: string | null): Section | undefined {
  if (!id) return undefined
  return data.sections.find((s) => s.id === id)
}

export function answerCodesFor(data: WorkspaceData, answerId: string): AnswerCode[] {
  return data.answerCodes.filter((ac) => ac.answerId === answerId)
}

export function codeById(data: WorkspaceData, id: string): Code | undefined {
  return data.codes.find((c) => c.id === id)
}

export function codeUsageCount(data: WorkspaceData, codeId: string): number {
  return data.answerCodes.filter((ac) => ac.codeId === codeId).length
}

export function isExcerptStale(answer: Answer, excerpt: string | null): boolean {
  if (!excerpt) return false
  return !answer.text.includes(excerpt)
}

export function categoriesForCode(data: WorkspaceData, codeId: string): Category[] {
  const ids = new Set(data.codeCategories.filter((cc) => cc.codeId === codeId).map((cc) => cc.categoryId))
  return data.categories.filter((c) => ids.has(c.id))
}

export function codesForCategory(data: WorkspaceData, categoryId: string): Code[] {
  const ids = new Set(data.codeCategories.filter((cc) => cc.categoryId === categoryId).map((cc) => cc.codeId))
  return data.codes.filter((c) => ids.has(c.id))
}

export function themesForCategory(data: WorkspaceData, categoryId: string): Theme[] {
  const ids = new Set(data.themeCategories.filter((tc) => tc.categoryId === categoryId).map((tc) => tc.themeId))
  return data.themes.filter((t) => ids.has(t.id))
}

export function categoriesForTheme(data: WorkspaceData, themeId: string): Category[] {
  const ids = new Set(data.themeCategories.filter((tc) => tc.themeId === themeId).map((tc) => tc.categoryId))
  return data.categories.filter((c) => ids.has(c.id))
}

export function evidenceForTheme(data: WorkspaceData, themeId: string) {
  return data.themeEvidence.filter((te) => te.themeId === themeId)
}

export function memosForTheme(data: WorkspaceData, themeId: string) {
  return data.memos.filter((m) => m.themeId === themeId)
}

export function statusCounts(data: WorkspaceData, projectId: string): Record<AnswerStatus, number> {
  const counts: Record<AnswerStatus, number> = {
    'Belum Dijawab': 0,
    Terisi: 0,
    'Perlu Klarifikasi': 0,
    Ditinjau: 0,
  }
  for (const answer of data.answers) {
    if (answer.projectId !== projectId) continue
    if (answer.status === 'Belum Dijawab' && answer.text.trim().length === 0) {
      counts['Belum Dijawab'] += 1
    } else {
      counts[answer.status] += 1
    }
  }
  return counts
}

export interface ProjectStats {
  questions: number
  activeQuestions: number
  respondents: number
  sessions: number
  completedSessions: number
  answersFilled: number
  answersTotal: number
  codes: number
  themes: number
  coverage: number
}

export function projectStats(data: WorkspaceData, projectId: string): ProjectStats {
  const questions = data.questions.filter((q) => q.projectId === projectId)
  const activeQuestions = questions.filter((q) => q.isActive)
  const respondents = data.respondents.filter((r) => r.projectId === projectId && !r.archivedAt)
  const sessions = data.sessions.filter((s) => s.projectId === projectId && s.status !== 'Diarsipkan')
  const answers = data.answers.filter((a) => a.projectId === projectId)
  const filled = answers.filter((a) => a.text.trim().length > 0)
  return {
    questions: questions.length,
    activeQuestions: activeQuestions.length,
    respondents: respondents.length,
    sessions: sessions.length,
    completedSessions: sessions.filter((s) => s.status === 'Selesai').length,
    answersFilled: filled.length,
    answersTotal: answers.length,
    codes: data.codes.filter((c) => c.projectId === projectId).length,
    themes: data.themes.filter((t) => t.projectId === projectId).length,
    coverage: answers.length === 0 ? 0 : Math.round((filled.length / answers.length) * 100),
  }
}

export function lastProjectActivity(data: WorkspaceData, projectId: string): string | null {
  const timestamps: string[] = []
  for (const session of data.sessions) if (session.projectId === projectId) timestamps.push(session.updatedAt)
  for (const answer of data.answers) if (answer.projectId === projectId) timestamps.push(answer.updatedAt)
  for (const question of data.questions) if (question.projectId === projectId) timestamps.push(question.updatedAt)
  for (const respondent of data.respondents) if (respondent.projectId === projectId) timestamps.push(respondent.updatedAt)
  if (timestamps.length === 0) return null
  return timestamps.sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0]
}

export interface QualityIssue {
  id: string
  severity: 'penting' | 'perhatian'
  label: string
  detail: string
  link?: string
}

export function qualityIssues(data: WorkspaceData, project: Project): QualityIssue[] {
  const issues: QualityIssue[] = []
  const questions = projectQuestions(data, project.id, true)
  const activeQuestions = questions.filter((q) => q.isActive)
  const sessions = projectSessions(data, project.id, true)
  const respondents = projectRespondents(data, project.id)

  const unansweredByQuestion = activeQuestions
    .map((q) => ({ q, count: questionAnswerCount(data, q.id) }))
    .filter((item) => item.count === 0)
  if (unansweredByQuestion.length > 0) {
    issues.push({
      id: 'unanswered-questions',
      severity: 'penting',
      label: `${unansweredByQuestion.length} pertanyaan aktif belum punya jawaban`,
      detail: 'Pertanyaan ini belum dijawab pada sesi mana pun. Periksa apakah sesi masih berjalan atau pertanyaan perlu diarsipkan.',
      link: `/p/${project.id}/data`,
    })
  }

  const blankAnswers = data.answers.filter(
    (a) => a.projectId === project.id && a.text.trim().length === 0 && a.status !== 'Belum Dijawab',
  )
  if (blankAnswers.length > 0) {
    issues.push({
      id: 'blank-answers',
      severity: 'penting',
      label: `${blankAnswers.length} jawaban kosong berstatus terisi`,
      detail: 'Jawaban kosong tidak dihitung sebagai progres. Ubah statusnya menjadi Belum Dijawab atau isi teksnya.',
      link: `/p/${project.id}/data`,
    })
  }

  const orphanAnswers = data.answers.filter((a) => {
    if (a.projectId !== project.id) return false
    const question = data.questions.find((q) => q.id === a.questionId)
    return !question || !question.isActive
  })
  if (orphanAnswers.length > 0) {
    issues.push({
      id: 'inactive-answers',
      severity: 'perhatian',
      label: `${orphanAnswers.length} jawaban berasal dari pertanyaan nonaktif`,
      detail: 'Jawaban tetap tersimpan untuk menjaga riwayat. Pertimbangkan menandai atau mengarsipkannya saat analisis.',
    })
  }

  const sessionsWithoutRespondent = sessions.filter(
    (s) => s.status !== 'Diarsipkan' && !respondents.some((r) => r.id === s.respondentId),
  )
  if (sessionsWithoutRespondent.length > 0) {
    issues.push({
      id: 'session-respondent',
      severity: 'penting',
      label: `${sessionsWithoutRespondent.length} sesi tidak memiliki narasumber aktif`,
      detail: 'Narasumber mungkin telah diarsipkan. Tinjau sesi sebelum melanjutkan analisis.',
      link: `/p/${project.id}/sesi`,
    })
  }

  const codesWithoutDescription = data.codes.filter((c) => c.projectId === project.id && c.description.trim() === '')
  if (codesWithoutDescription.length > 0) {
    issues.push({
      id: 'codes-description',
      severity: 'perhatian',
      label: `${codesWithoutDescription.length} kode belum memiliki deskripsi`,
      detail: 'Deskripsi membantu menjaga makna kode tetap konsisten saat analisis berlanjut.',
      link: `/p/${project.id}/analisis`,
    })
  }

  const staleCodes = data.answerCodes.filter((ac) => {
    if (ac.projectId !== project.id || !ac.excerpt) return false
    const answer = data.answers.find((a) => a.id === ac.answerId)
    return !answer || !answer.text.includes(ac.excerpt)
  })
  if (staleCodes.length > 0) {
    issues.push({
      id: 'stale-codes',
      severity: 'penting',
      label: `${staleCodes.length} coding tidak lagi cocok dengan teks jawaban`,
      detail: 'Kutipan kode tidak ditemukan pada jawaban terbaru. Tinjau hubungan kode dengan sumbernya.',
      link: `/p/${project.id}/analisis`,
    })
  }

  const themesWithoutEvidence = data.themes.filter(
    (t) => t.projectId === project.id && evidenceForTheme(data, t.id).length === 0,
  )
  if (themesWithoutEvidence.length > 0) {
    issues.push({
      id: 'themes-evidence',
      severity: 'penting',
      label: `${themesWithoutEvidence.length} tema belum memiliki bukti sumber`,
      detail: 'Tema tanpa kutipan pendukung tidak dapat ditelusuri ke jawaban asli.',
      link: `/p/${project.id}/analisis`,
    })
  }

  const duplicateCodes = new Map<string, number>()
  for (const respondent of respondents) {
    duplicateCodes.set(respondent.code.toLowerCase(), (duplicateCodes.get(respondent.code.toLowerCase()) ?? 0) + 1)
  }
  const duplicates = [...duplicateCodes.values()].filter((count) => count > 1).length
  if (duplicates > 0) {
    issues.push({
      id: 'duplicate-respondent-code',
      severity: 'penting',
      label: `${duplicates} kode narasumber dipakai lebih dari sekali`,
      detail: 'Kode narasumber harus unik agar jawaban tidak tertukar.',
      link: `/p/${project.id}/narasumber`,
    })
  }

  return issues
}
