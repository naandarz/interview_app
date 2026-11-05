import type {
  Answer,
  InterviewSession,
  Project,
  Respondent,
  WorkspaceData,
} from './types'
import { formatDate, formatDateLong, slugify } from './utils'
import { projectQuestions, projectRespondents, projectSections, projectSessions } from './selectors'

export const EXPORT_TYPES = [
  { id: 'panduan', label: 'Panduan wawancara', description: 'Bagian dan daftar pertanyaan sesuai urutan.' },
  { id: 'per-narasumber', label: 'Hasil per narasumber', description: 'Profil, sesi, pertanyaan, dan jawaban per narasumber.' },
  { id: 'per-pertanyaan', label: 'Hasil per pertanyaan', description: 'Satu pertanyaan dengan jawaban dari semua narasumber.' },
  { id: 'data-mentah', label: 'Data mentah', description: 'Tabel jawaban terstruktur untuk diolah kembali.' },
  { id: 'coding', label: 'Coding', description: 'Kode, kutipan, jawaban sumber, dan narasumber.' },
  { id: 'analisis', label: 'Analisis', description: 'Kategori, tema, memo, dan bukti jawaban.' },
  { id: 'laporan', label: 'Laporan lengkap', description: 'Ringkasan proyek sampai hasil analisis.' },
] as const

export type ExportType = (typeof EXPORT_TYPES)[number]['id']
export type ExportFormat = 'docx' | 'pdf' | 'csv'
export type ExportScope = 'project' | 'respondent' | 'session'

export interface ExportOptions {
  type: ExportType
  format: ExportFormat
  scope: ExportScope
  scopeId: string | null
  anonymize: boolean
}

export interface ExportTable {
  headers: string[]
  rows: string[][]
}

export interface ExportBlock {
  heading?: string
  paragraphs?: string[]
  list?: string[]
  quote?: { text: string; source: string }
  table?: ExportTable
}

export interface ExportDocument {
  fileName: string
  title: string
  subtitle: string
  meta: string[]
  blocks: ExportBlock[]
  csv: ExportTable | null
  coverageNote: string
}

export function allowedFormats(type: ExportType): ExportFormat[] {
  if (type === 'panduan' || type === 'analisis' || type === 'laporan') return ['docx', 'pdf']
  return ['docx', 'pdf', 'csv']
}

export function scopeLabel(options: ExportOptions, data: WorkspaceData): string {
  if (options.scope === 'respondent') {
    const respondent = data.respondents.find((r) => r.id === options.scopeId)
    if (!respondent) return 'Narasumber tidak ditemukan'
    return `${respondent.code}${respondent.displayName ? ` · ${respondent.displayName}` : ''}`
  }
  if (options.scope === 'session') {
    const session = data.sessions.find((s) => s.id === options.scopeId)
    if (!session) return 'Sesi tidak ditemukan'
    return `${session.title} · ${formatDate(session.interviewDate)}`
  }
  return 'Seluruh proyek'
}

function respondentLabel(respondent: Respondent | undefined, anonymize: boolean): string {
  if (!respondent) return 'Narasumber tidak ditemukan'
  const name = anonymize ? '' : respondent.displayName
  return name ? `${respondent.code} (${name})` : respondent.code
}

function sessionLabel(session: InterviewSession): string {
  return `${session.title}, ${formatDate(session.interviewDate)}`
}

function scopedSessions(data: WorkspaceData, project: Project, options: ExportOptions): InterviewSession[] {
  let sessions = projectSessions(data, project.id)
  if (options.scope === 'respondent' && options.scopeId) {
    sessions = sessions.filter((s) => s.respondentId === options.scopeId)
  }
  if (options.scope === 'session' && options.scopeId) {
    sessions = sessions.filter((s) => s.id === options.scopeId)
  }
  return sessions.sort((a, b) => new Date(a.interviewDate).getTime() - new Date(b.interviewDate).getTime())
}

function scopedRespondents(data: WorkspaceData, project: Project, options: ExportOptions): Respondent[] {
  let respondents = projectRespondents(data, project.id, true)
  if (options.scope === 'respondent' && options.scopeId) {
    respondents = respondents.filter((r) => r.id === options.scopeId)
  }
  if (options.scope === 'session' && options.scopeId) {
    const session = data.sessions.find((s) => s.id === options.scopeId)
    respondents = session ? respondents.filter((r) => r.id === session.respondentId) : []
  }
  return respondents
}

function answerFor(data: WorkspaceData, sessionId: string, questionId: string): Answer | undefined {
  return data.answers.find((a) => a.sessionId === sessionId && a.questionId === questionId)
}

function isFilled(answer: Answer | undefined): boolean {
  return Boolean(answer && answer.text.trim().length > 0)
}

function emptyNote(data: WorkspaceData, sessions: InterviewSession[]): string {
  const sessionIds = new Set(sessions.map((s) => s.id))
  const empty = data.answers.filter((a) => sessionIds.has(a.sessionId) && a.text.trim().length === 0)
  if (empty.length === 0) return 'Seluruh jawaban pada cakupan ini terisi.'
  return `${empty.length} jawaban kosong pada cakupan ini tidak disertakan sebagai isi jawaban.`
}

export function buildExport(data: WorkspaceData, project: Project, options: ExportOptions): ExportDocument {
  const sessions = scopedSessions(data, project, options)
  const sessionIds = new Set(sessions.map((s) => s.id))
  const respondents = scopedRespondents(data, project, options)
  const questions = projectQuestions(data, project.id, true)
  const sections = projectSections(data, project.id)
  const coverageNote = emptyNote(data, sessions)
  const stamp = new Date().toISOString().slice(0, 10)
  const fileNameBase = `${slugify(project.title)}-${options.type}-${stamp}`

  const baseMeta = [
    `Proyek: ${project.title}`,
    `Cakupan: ${scopeLabel(options, data)}`,
    `Dibuat: ${formatDateLong(new Date().toISOString())}`,
    options.anonymize ? 'Identitas narasumber: dianonimkan menggunakan kode.' : 'Identitas narasumber: ditampilkan sesuai data proyek.',
    coverageNote,
  ]

  const doc = (title: string, subtitle: string, blocks: ExportBlock[], csv: ExportTable | null = null): ExportDocument => ({
    fileName: `${fileNameBase}.${options.format}`,
    title,
    subtitle,
    meta: baseMeta,
    blocks,
    csv,
    coverageNote,
  })

  if (options.type === 'panduan') {
    const blocks: ExportBlock[] = []
    let counter = 0
    for (const section of sections) {
      const sectionQuestions = questions.filter((q) => q.sectionId === section.id && q.isActive)
      if (sectionQuestions.length === 0) continue
      blocks.push({
        heading: section.title,
        paragraphs: section.description ? [section.description] : undefined,
        list: sectionQuestions.map((q) => {
          counter += 1
          return `${String(counter).padStart(2, '0')}. ${q.text}${q.isRequired ? ' (wajib)' : ' (opsional)'}${
            q.guidance ? `\n    Petunjuk: ${q.guidance}` : ''
          }`
        }),
      })
    }
    const unsectioned = questions.filter((q) => q.isActive && (!q.sectionId || !sections.some((s) => s.id === q.sectionId)))
    if (unsectioned.length > 0) {
      blocks.push({
        heading: 'Pertanyaan lain',
        list: unsectioned.map((q) => {
          counter += 1
          return `${String(counter).padStart(2, '0')}. ${q.text}${q.isRequired ? ' (wajib)' : ' (opsional)'}`
        }),
      })
    }
    if (blocks.length === 0) {
      blocks.push({ paragraphs: ['Belum ada pertanyaan aktif pada panduan ini.'] })
    }
    return doc('Panduan Wawancara', project.title, blocks)
  }

  if (options.type === 'per-narasumber') {
    const blocks: ExportBlock[] = []
    for (const respondent of respondents) {
      const respondentSessions = sessions.filter((s) => s.respondentId === respondent.id)
      blocks.push({
        heading: respondentLabel(respondent, options.anonymize),
        paragraphs: [
          respondent.profileNotes ? `Profil: ${respondent.profileNotes}` : 'Profil: tidak dicatat.',
          respondentSessions.length === 0 ? 'Belum ada sesi wawancara untuk narasumber ini.' : `Jumlah sesi: ${respondentSessions.length}.`,
        ],
      })
      for (const session of respondentSessions) {
        blocks.push({
          heading: sessionLabel(session),
          paragraphs: [
            `Metode: ${session.method}. Durasi: ${session.durationMinutes ?? 'tidak dicatat'} menit. Status: ${session.status}.`,
            session.notes ? `Catatan sesi: ${session.notes}` : '',
          ].filter(Boolean),
        })
        for (const sessionQuestionId of session.questionIds) {
          const question = questions.find((q) => q.id === sessionQuestionId)
          if (!question) continue
          const answer = answerFor(data, session.id, question.id)
          if (!isFilled(answer)) continue
          blocks.push({
            heading: question.text,
            paragraphs: [
              `Jawaban: ${answer!.text.trim()}`,
              answer!.interviewerNotes ? `Catatan pewawancara: ${answer!.interviewerNotes}` : '',
              `Status jawaban: ${answer!.status}.`,
            ].filter(Boolean),
          })
        }
      }
    }
    if (blocks.length === 0) blocks.push({ paragraphs: ['Tidak ada data narasumber pada cakupan ini.'] })
    const csv: ExportTable = {
      headers: ['Kode', ...(options.anonymize ? [] : ['Nama']), 'Sesi', 'Tanggal', 'Pertanyaan', 'Jawaban', 'Catatan pewawancara', 'Status'],
      rows: sessions.flatMap((session) => {
        const respondent = data.respondents.find((r) => r.id === session.respondentId)
        return session.questionIds.flatMap((qid) => {
          const question = questions.find((q) => q.id === qid)
          const answer = answerFor(data, session.id, qid)
          if (!question || !isFilled(answer)) return []
          return [[
            respondent?.code ?? '',
            ...(options.anonymize ? [] : [respondent?.displayName ?? '']),
            session.title,
            formatDate(session.interviewDate),
            question.text,
            answer!.text,
            answer!.interviewerNotes,
            answer!.status,
          ]]
        })
      }),
    }
    return doc('Hasil Wawancara per Narasumber', project.title, blocks, csv)
  }

  if (options.type === 'per-pertanyaan') {
    const blocks: ExportBlock[] = []
    const questionsInScope = questions.filter((q) => {
      if (!q.isActive) return false
      return sessions.some((s) => s.questionIds.includes(q.id) && isFilled(answerFor(data, s.id, q.id)))
    })
    for (const question of questionsInScope) {
      const section = sections.find((s) => s.id === question.sectionId)
      const entries: string[] = []
      for (const session of sessions) {
        if (!session.questionIds.includes(question.id)) continue
        const answer = answerFor(data, session.id, question.id)
        if (!isFilled(answer)) continue
        const respondent = data.respondents.find((r) => r.id === session.respondentId)
        entries.push(
          `${respondentLabel(respondent, options.anonymize)} · ${formatDate(session.interviewDate)} · ${answer!.status}\n${answer!.text.trim()}${
            answer!.interviewerNotes ? `\nCatatan pewawancara: ${answer!.interviewerNotes}` : ''
          }`,
        )
      }
      blocks.push({
        heading: question.text,
        paragraphs: [section ? `Bagian: ${section.title}` : 'Tanpa bagian'],
        list: entries.length > 0 ? entries : ['Belum ada jawaban untuk pertanyaan ini pada cakupan yang dipilih.'],
      })
    }
    if (blocks.length === 0) blocks.push({ paragraphs: ['Belum ada jawaban pada cakupan ini.'] })
    const csv: ExportTable = {
      headers: ['Pertanyaan', 'Bagian', 'Kode', ...(options.anonymize ? [] : ['Nama']), 'Tanggal', 'Jawaban', 'Status'],
      rows: questionsInScope.flatMap((question) => {
        const section = sections.find((s) => s.id === question.sectionId)
        return sessions.flatMap((session) => {
          if (!session.questionIds.includes(question.id)) return []
          const answer = answerFor(data, session.id, question.id)
          if (!isFilled(answer)) return []
          const respondent = data.respondents.find((r) => r.id === session.respondentId)
          return [[
            question.text,
            section?.title ?? '',
            respondent?.code ?? '',
            ...(options.anonymize ? [] : [respondent?.displayName ?? '']),
            formatDate(session.interviewDate),
            answer!.text,
            answer!.status,
          ]]
        })
      }),
    }
    return doc('Hasil Wawancara per Pertanyaan', project.title, blocks, csv)
  }

  if (options.type === 'data-mentah') {
    const rows: string[][] = []
    const scopedQuestionIds = new Set(sessions.flatMap((s) => s.questionIds))
    const scopedQuestions = questions.filter((q) => scopedQuestionIds.has(q.id))
    for (const session of sessions) {
      const respondent = data.respondents.find((r) => r.id === session.respondentId)
      for (const question of scopedQuestions) {
        if (!session.questionIds.includes(question.id)) continue
        const answer = answerFor(data, session.id, question.id)
        if (!answer) continue
        rows.push([
          respondent?.code ?? '',
          options.anonymize ? '' : respondent?.displayName ?? '',
          session.title,
          formatDate(session.interviewDate),
          question.text,
          answer.text,
          answer.interviewerNotes,
          answer.status,
          formatDate(answer.updatedAt, true),
        ])
      }
    }
    const csv: ExportTable = {
      headers: [
        'Kode narasumber',
        ...(options.anonymize ? [] : ['Nama narasumber']),
        'Sesi',
        'Tanggal sesi',
        'Pertanyaan',
        'Jawaban',
        'Catatan pewawancara',
        'Status jawaban',
        'Terakhir diperbarui',
      ],
      rows,
    }
    const blocks: ExportBlock[] = [
      {
        heading: 'Ringkasan data',
        paragraphs: [
          `Jumlah baris jawaban: ${rows.length}.`,
          `Jumlah sesi: ${sessions.length}. Jumlah narasumber: ${new Set(sessions.map((s) => s.respondentId)).size}.`,
          coverageNote,
        ],
      },
      { heading: 'Tabel data jawaban', table: csv },
    ]
    return doc('Data Mentah Jawaban', project.title, blocks, csv)
  }

  if (options.type === 'coding') {
    const codes = data.codes.filter((c) => c.projectId === project.id)
    const scopedAnswerIds = new Set(data.answers.filter((a) => sessionIds.has(a.sessionId)).map((a) => a.id))
    const answerCodes = data.answerCodes.filter((ac) => ac.projectId === project.id && scopedAnswerIds.has(ac.answerId))
    const rows = answerCodes.map((ac) => {
      const code = codes.find((c) => c.id === ac.codeId)
      const answer = data.answers.find((a) => a.id === ac.answerId)
      const session = data.sessions.find((s) => s.id === answer?.sessionId)
      const respondent = data.respondents.find((r) => r.id === session?.respondentId)
      const question = data.questions.find((q) => q.id === answer?.questionId)
      const categories = data.codeCategories
        .filter((cc) => cc.codeId === ac.codeId)
        .map((cc) => data.categories.find((c) => c.id === cc.categoryId)?.name ?? '')
        .filter(Boolean)
      return [
        code?.name ?? '',
        categories.join('; '),
        ac.excerpt ?? answer?.text ?? '',
        ac.note,
        respondent?.code ?? '',
        ...(options.anonymize ? [] : [respondent?.displayName ?? '']),
        question?.text ?? '',
        session ? formatDate(session.interviewDate) : '',
      ]
    })
    const csv: ExportTable = {
      headers: ['Kode', 'Kategori', 'Kutipan', 'Catatan kode', 'Narasumber', ...(options.anonymize ? [] : ['Nama']), 'Pertanyaan', 'Tanggal'],
      rows,
    }
    const blocks: ExportBlock[] = [
      { heading: 'Ringkasan coding', paragraphs: [`Jumlah kode: ${codes.length}. Jumlah penerapan kode: ${rows.length}.`] },
      {
        heading: 'Daftar kode',
        list: codes.map((code) => {
          const usages = rows.filter((row) => row[0] === code.name).length
          return `${code.name} (${usages} penerapan)${code.description ? `: ${code.description}` : ''}`
        }),
      },
      ...codes.map<ExportBlock>((code) => ({
        heading: `Kutipan untuk ${code.name}`,
        list: rows
          .filter((row) => row[0] === code.name)
          .map((row) => {
            // Saat anonim, kolom Nama tidak ada sehingga indeks bergeser satu.
            const name = options.anonymize ? '' : row[5]
            return `${row[4]}${name ? ` (${name})` : ''}: “${row[2]}”${row[3] ? ` Catatan: ${row[3]}` : ''}`
          }),
      })),
    ]
    return doc('Hasil Coding', project.title, blocks, csv)
  }

  if (options.type === 'analisis') {
    const categories = data.categories.filter((c) => c.projectId === project.id)
    const themes = data.themes.filter((t) => t.projectId === project.id)
    const codes = data.codes.filter((c) => c.projectId === project.id)
    const blocks: ExportBlock[] = [
      {
        heading: 'Ringkasan analisis',
        paragraphs: [
          `Jumlah kode: ${codes.length}. Jumlah kategori: ${categories.length}. Jumlah tema: ${themes.length}.`,
          'Bagian ini merupakan interpretasi peneliti. Kutipan sumber disertakan agar setiap temuan dapat ditelusuri.',
        ],
      },
      {
        heading: 'Kategori',
        list: categories.map((category) => {
          const categoryCodes = data.codeCategories
            .filter((cc) => cc.categoryId === category.id)
            .map((cc) => codes.find((c) => c.id === cc.codeId)?.name ?? '')
            .filter(Boolean)
          return `${category.name}${category.description ? `: ${category.description}` : ''} [Kode: ${
            categoryCodes.length > 0 ? categoryCodes.join(', ') : 'belum ada'
          }]`
        }),
      },
    ]
    for (const theme of themes) {
      const themeCategories = data.themeCategories
        .filter((tc) => tc.themeId === theme.id)
        .map((tc) => categories.find((c) => c.id === tc.categoryId)?.name ?? '')
        .filter(Boolean)
      const evidence = data.themeEvidence.filter((te) => te.themeId === theme.id)
      const themeMemos = data.memos.filter((m) => m.themeId === theme.id)
      blocks.push({
        heading: `Tema: ${theme.name}`,
        paragraphs: [
          theme.description ? `Deskripsi: ${theme.description}` : 'Deskripsi belum diisi.',
          theme.interpretation ? `Interpretasi: ${theme.interpretation}` : 'Interpretasi belum diisi.',
          themeCategories.length > 0 ? `Kategori pendukung: ${themeCategories.join(', ')}.` : 'Belum ada kategori pendukung.',
        ],
      })
      for (const item of evidence) {
        const answer = data.answers.find((a) => a.id === item.answerId)
        const session = data.sessions.find((s) => s.id === answer?.sessionId)
        const respondent = data.respondents.find((r) => r.id === session?.respondentId)
        blocks.push({
          heading: 'Bukti sumber',
          quote: {
            text: item.excerpt,
            source: `${respondentLabel(respondent, options.anonymize)} · ${session ? formatDate(session.interviewDate) : 'tanggal tidak diketahui'}${
              item.note ? ` · ${item.note}` : ''
            }`,
          },
        })
      }
      if (evidence.length === 0) {
        blocks.push({ paragraphs: ['Tema ini belum memiliki kutipan bukti sumber.'] })
      }
      for (const memo of themeMemos) {
        blocks.push({ heading: 'Memo analisis', paragraphs: [memo.content] })
      }
    }
    const blocksWithMemo = data.memos.filter((m) => m.themeId === null && m.projectId === project.id)
    if (blocksWithMemo.length > 0) {
      blocks.push({ heading: 'Memo umum', list: blocksWithMemo.map((m) => m.content) })
    }
    return doc('Laporan Analisis', project.title, blocks)
  }

  // Full report
  const stats = {
    respondents: respondents.length,
    sessions: sessions.length,
    questions: questions.filter((q) => q.isActive).length,
    filled: data.answers.filter((a) => sessionIds.has(a.sessionId) && a.text.trim().length > 0).length,
  }
  const reportBlocks: ExportBlock[] = [
    {
      heading: 'Ringkasan proyek',
      paragraphs: [
        `Tujuan: ${project.objective || 'belum diisi.'}`,
        `Deskripsi: ${project.description || 'belum diisi.'}`,
        project.generalNotes ? `Catatan umum: ${project.generalNotes}` : '',
        `Narasumber: ${stats.respondents}. Sesi: ${stats.sessions}. Pertanyaan aktif: ${stats.questions}. Jawaban terisi: ${stats.filled}.`,
      ].filter(Boolean),
    },
  ]
  const guideBlocks: ExportBlock[] = []
  let counter = 0
  for (const section of sections) {
    const sectionQuestions = questions.filter((q) => q.sectionId === section.id && q.isActive)
    if (sectionQuestions.length === 0) continue
    guideBlocks.push({
      heading: section.title,
      list: sectionQuestions.map((q) => {
        counter += 1
        return `${String(counter).padStart(2, '0')}. ${q.text}`
      }),
    })
  }
  reportBlocks.push({ heading: 'Panduan pertanyaan', paragraphs: ['Daftar pertanyaan aktif yang digunakan pada proyek ini.'] }, ...guideBlocks)

  for (const respondent of respondents) {
    const respondentSessions = sessions.filter((s) => s.respondentId === respondent.id)
    if (respondentSessions.length === 0) continue
    const entries: string[] = []
    for (const session of respondentSessions) {
      entries.push(`${sessionLabel(session)} · ${session.status}`)
      for (const qid of session.questionIds) {
        const question = questions.find((q) => q.id === qid)
        const answer = answerFor(data, session.id, qid)
        if (!question || !isFilled(answer)) continue
        entries.push(`${question.text}\n${answer!.text.trim()}`)
      }
    }
    reportBlocks.push({ heading: `Hasil ${respondentLabel(respondent, options.anonymize)}`, list: entries })
  }

  const themes = data.themes.filter((t) => t.projectId === project.id)
  reportBlocks.push({ heading: 'Hasil analisis', paragraphs: [`Jumlah tema: ${themes.length}.`] })
  for (const theme of themes) {
    const evidence = data.themeEvidence.filter((te) => te.themeId === theme.id)
    reportBlocks.push({
      heading: theme.name,
      paragraphs: [theme.description, theme.interpretation].filter(Boolean),
    })
    for (const item of evidence) {
      const answer = data.answers.find((a) => a.id === item.answerId)
      const session = data.sessions.find((s) => s.id === answer?.sessionId)
      const respondent = data.respondents.find((r) => r.id === session?.respondentId)
      reportBlocks.push({
        heading: 'Kutipan pendukung',
        quote: {
          text: item.excerpt,
          source: `${respondentLabel(respondent, options.anonymize)} · ${session ? formatDate(session.interviewDate) : 'tanggal tidak diketahui'}`,
        },
      })
    }
  }
  const memos = data.memos.filter((m) => m.projectId === project.id)
  if (memos.length > 0) {
    reportBlocks.push({ heading: 'Memo analisis', list: memos.map((m) => m.content) })
  }
  reportBlocks.push({
    heading: 'Catatan keterbatasan',
    paragraphs: [
      'Laporan ini dibuat dari data yang tercatat pada aplikasi. Kutipan hanya diambil dari jawaban narasumber yang tersimpan. Bagian analisis merupakan interpretasi peneliti dan bukan hasil otomatis.',
    ],
  })
  return doc('Laporan Lengkap Wawancara', project.title, reportBlocks)
}

export function exportPreviewText(document: ExportDocument): string {
  const lines: string[] = [document.title, document.subtitle, '', ...document.meta, '']
  for (const block of document.blocks) {
    if (block.heading) lines.push(block.heading.toUpperCase(), '')
    for (const paragraph of block.paragraphs ?? []) lines.push(paragraph, '')
    for (const item of block.list ?? []) lines.push(`- ${item.replace(/\n/g, '\n  ')}`, '')
    if (block.quote) {
      lines.push(`“${block.quote.text}”`, `Sumber: ${block.quote.source}`, '')
    }
    if (block.table) {
      lines.push(block.table.headers.join(' | '))
      for (const row of block.table.rows.slice(0, 12)) lines.push(row.join(' | '))
      if (block.table.rows.length > 12) lines.push(`... dan ${block.table.rows.length - 12} baris lainnya.`)
      lines.push('')
    }
  }
  return lines.join('\n')
}

function csvCell(value: string): string {
  let clean = value.replace(/\r?\n/g, ' ').replace(/"/g, '""')
  // Cegah formula injection saat file dibuka di Excel/Sheets. Nilai tetap terbaca
  // sebagai teks karena diawali apostrof dan dibungkus tanda kutip.
  if (/^[=+\-@\t\r]/.test(clean)) clean = `'${clean}`
  return `"${clean}"`
}

export function buildCsv(table: ExportTable): string {
  const lines = [table.headers.map(csvCell).join(','), ...table.rows.map((row) => row.map(csvCell).join(','))]
  return `\uFEFF${lines.join('\r\n')}`
}

export async function buildDocx(document: ExportDocument): Promise<Blob> {
  const docx = await import('docx')
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell, WidthType } = docx

  const children: Array<InstanceType<typeof Paragraph> | InstanceType<typeof Table>> = []
  children.push(
    new Paragraph({
      children: [new TextRun({ text: document.title, bold: true, size: 34, color: '0F5A4E' })],
      spacing: { after: 120 },
    }),
    new Paragraph({
      children: [new TextRun({ text: document.subtitle, size: 24, color: '4E574F' })],
      spacing: { after: 200 },
    }),
  )

  for (const meta of document.meta) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: meta, size: 18, color: '6B756C' })],
        spacing: { after: 40 },
      }),
    )
  }
  children.push(new Paragraph({ children: [], spacing: { after: 160 } }))

  for (const block of document.blocks) {
    if (block.heading) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: block.heading, bold: true, size: 24 })],
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 260, after: 100 },
        }),
      )
    }
    for (const paragraph of block.paragraphs ?? []) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: paragraph, size: 21 })],
          spacing: { after: 100 },
        }),
      )
    }
    for (const item of block.list ?? []) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: item, size: 21 })],
          bullet: { level: 0 },
          spacing: { after: 60 },
        }),
      )
    }
    if (block.quote) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: `“${block.quote.text}”`, italics: true, size: 21 })],
          indent: { left: 480 },
          spacing: { before: 80, after: 40 },
        }),
        new Paragraph({
          children: [new TextRun({ text: `Sumber: ${block.quote.source}`, size: 18, color: '6B756C' })],
          indent: { left: 480 },
          spacing: { after: 160 },
        }),
      )
    }
    if (block.table) {
      const table = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            tableHeader: true,
            children: block.table.headers.map(
              (header) =>
                new TableCell({
                  shading: { fill: 'EAF1EC' },
                  children: [new Paragraph({ children: [new TextRun({ text: header, bold: true, size: 17 })] })],
                }),
            ),
          }),
          ...block.table.rows.slice(0, 400).map(
            (row) =>
              new TableRow({
                children: row.map(
                  (cell) =>
                    new TableCell({
                      children: [new Paragraph({ children: [new TextRun({ text: cell.slice(0, 1200), size: 16 })] })],
                    }),
                ),
              }),
          ),
        ],
      })
      children.push(table, new Paragraph({ children: [], spacing: { after: 160 } }))
    }
  }

  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: 'Dibuat dengan Interview Workspace. Data disimpan dan diekspor dari perangkat pengguna.',
          size: 16,
          color: '8A938B',
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { before: 320 },
    }),
  )

  const doc = new Document({ sections: [{ children }] })
  return Packer.toBlob(doc)
}

export async function buildPdf(document: ExportDocument): Promise<Blob> {
  const { jsPDF } = await import('jspdf')
  const pdf = new jsPDF({ unit: 'pt', format: 'a4' })
  const width = pdf.internal.pageSize.getWidth()
  const height = pdf.internal.pageSize.getHeight()
  const margin = 48
  const maxWidth = width - margin * 2
  let y = margin

  const ensureSpace = (needed: number) => {
    if (y + needed > height - margin) {
      pdf.addPage()
      y = margin
    }
  }

  const write = (text: string, size: number, options?: { bold?: boolean; color?: [number, number, number]; gap?: number; indent?: number }) => {
    pdf.setFontSize(size)
    pdf.setFont('helvetica', options?.bold ? 'bold' : 'normal')
    if (options?.color) pdf.setTextColor(...options.color)
    else pdf.setTextColor(28, 32, 29)
    const indent = options?.indent ?? 0
    const lines = pdf.splitTextToSize(text, maxWidth - indent) as string[]
    for (const line of lines) {
      ensureSpace(size + 6)
      pdf.text(line, margin + indent, y)
      y += size + 4
    }
    y += options?.gap ?? 0
  }

  write(document.title, 20, { bold: true, color: [15, 90, 78], gap: 6 })
  write(document.subtitle, 12, { color: [78, 87, 79], gap: 8 })
  for (const meta of document.meta) write(meta, 8.5, { color: [107, 117, 108], gap: 1 })
  y += 12

  for (const block of document.blocks) {
    if (block.heading) {
      ensureSpace(30)
      y += 6
      write(block.heading, 12, { bold: true, color: [15, 90, 78], gap: 3 })
    }
    for (const paragraph of block.paragraphs ?? []) write(paragraph, 10, { gap: 4 })
    for (const item of block.list ?? []) write(`• ${item}`, 10, { gap: 3, indent: 8 })
    if (block.quote) {
      write(`“${block.quote.text}”`, 10, { gap: 1, indent: 14 })
      write(`Sumber: ${block.quote.source}`, 8.5, { color: [107, 117, 108], gap: 6, indent: 14 })
    }
    if (block.table) {
      y += 4
      write(block.table.headers.join('  |  '), 8, { bold: true, gap: 2 })
      for (const row of block.table.rows.slice(0, 250)) {
        write(row.map((cell) => cell.replace(/\n/g, ' ').slice(0, 180)).join('  |  '), 7.5, { gap: 1 })
      }
      y += 6
    }
  }

  ensureSpace(30)
  write('Dibuat dengan Interview Workspace. Kutipan berasal dari jawaban yang tersimpan pada aplikasi.', 7.5, {
    color: [138, 147, 139],
  })

  return pdf.output('blob')
}

export async function generateExportFile(data: WorkspaceData, project: Project, options: ExportOptions): Promise<{ document: ExportDocument; blob: Blob }> {
  const document = buildExport(data, project, options)
  if (options.format === 'docx') {
    return { document, blob: await buildDocx(document) }
  }
  if (options.format === 'pdf') {
    return { document, blob: await buildPdf(document) }
  }
  const table = document.csv
  if (!table) {
    throw new Error('Format CSV tidak tersedia untuk jenis ekspor ini. Pilih DOCX atau PDF.')
  }
  return { document, blob: new Blob([buildCsv(table)], { type: 'text/csv;charset=utf-8' }) }
}
