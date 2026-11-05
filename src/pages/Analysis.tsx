import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { usePageTitle, useProject } from '../lib/hooks'
import { useWorkspace } from '../lib/store'
import type { Answer, Question, Respondent, Section } from '../lib/types'
import {
  categoriesForTheme,
  evidenceForTheme,
  projectQuestions,
  projectRespondents,
  projectSessions,
  qualityIssues,
  sessionProgress,
} from '../lib/selectors'
import { formatDate } from '../lib/utils'
import { AnalysisCoding } from '../components/AnalysisCoding'
import { AnalysisThemes } from '../components/AnalysisThemes'
import { Icon } from '../components/Icon'
import {
  Badge,
  Button,
  EmptyState,
  InlineNotice,
  PageHeader,
  Progress,
  Select,
  StatusBadge,
  Switch,
  Tabs,
  cx,
} from '../components/ui'

const TAB_IDS = ['ringkasan', 'coding', 'tema', 'perbandingan'] as const
type TabId = (typeof TAB_IDS)[number]

function isTabId(value: string | null): value is TabId {
  return value !== null && (TAB_IDS as readonly string[]).includes(value)
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-[10px] border border-line bg-surface px-4 py-3.5">
      <p className="mono-meta uppercase text-ink-muted">{label}</p>
      <p className="mt-1.5 text-[22px] font-semibold leading-none tracking-[-0.02em] text-ink">{value}</p>
      <p className="mt-1 text-[11px] leading-snug text-ink-muted">{detail}</p>
    </div>
  )
}

function issueTarget(issueId: string, link: string | undefined): string | null {
  if (issueId === 'themes-evidence') return '?tab=tema'
  if (issueId === 'codes-description' || issueId === 'stale-codes') return '?tab=coding'
  return link ?? null
}

function statusDistribution(answers: Answer[]) {
  const counted = { Terisi: 0, 'Perlu Klarifikasi': 0, Ditinjau: 0, 'Belum Dijawab': 0 }
  for (const answer of answers) {
    if (answer.text.trim().length === 0) {
      counted['Belum Dijawab'] += 1
    } else {
      counted[answer.status] += 1
    }
  }
  return counted
}

const DISTRIBUTION_ORDER = [
  { key: 'Terisi', bar: 'bg-success', swatch: 'bg-success', label: 'Terisi' },
  { key: 'Ditinjau', bar: 'bg-info', swatch: 'bg-info', label: 'Ditinjau' },
  { key: 'Perlu Klarifikasi', bar: 'bg-warn', swatch: 'bg-warn', label: 'Perlu klarifikasi' },
  { key: 'Belum Dijawab', bar: 'bg-line-strong', swatch: 'bg-line-strong', label: 'Belum dijawab' },
] as const

interface MatrixCell {
  answer: Answer | null
  sessionId: string | null
  sessionDate: string | null
}

function CellContent({ cell }: { cell: MatrixCell }) {
  if (!cell.sessionId) {
    return <span className="text-[11px] text-ink-muted">Tidak ada sesi</span>
  }
  if (!cell.answer) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] text-ink-muted">
        <span className="h-1.5 w-1.5 rounded-full bg-line-strong" aria-hidden="true" />
        Belum dijawab
      </span>
    )
  }
  return (
    <span className="block">
      <StatusBadge status={cell.answer.status} />
      <span className="mt-1 line-clamp-3 block text-[11.5px] leading-snug text-ink-soft">{cell.answer.text}</span>
      <span className="mono-meta mt-1 block truncate text-ink-muted">{formatDate(cell.sessionDate)}</span>
    </span>
  )
}

function ComparisonMatrix({
  projectId,
  respondents,
  questions,
  sessions,
  answers,
  sections,
}: {
  projectId: string
  respondents: Respondent[]
  questions: Question[]
  sessions: ReturnType<typeof projectSessions>
  answers: Answer[]
  sections: Section[]
}) {
  const [onlyAnswered, setOnlyAnswered] = useState(false)
  const [sectionFilter, setSectionFilter] = useState('semua')
  const [questionFilter, setQuestionFilter] = useState('')

  const filteredQuestions = useMemo(() => {
    const needle = questionFilter.trim().toLowerCase()
    return questions.filter((question) => {
      if (needle && !question.text.toLowerCase().includes(needle)) return false
      if (sectionFilter === 'tanpa' && question.sectionId) return false
      if (sectionFilter !== 'semua' && sectionFilter !== 'tanpa' && question.sectionId !== sectionFilter) return false
      return true
    })
  }, [questions, questionFilter, sectionFilter])

  const rowSessions = useMemo(() => {
    const map = new Map<string, typeof sessions>()
    for (const respondent of respondents) {
      map.set(
        respondent.id,
        sessions
          .filter((session) => session.respondentId === respondent.id)
          .sort((a, b) => new Date(b.interviewDate).getTime() - new Date(a.interviewDate).getTime()),
      )
    }
    return map
  }, [respondents, sessions])

  const resolveCell = (respondentId: string, questionId: string): MatrixCell => {
    const sessionsForRespondent = rowSessions.get(respondentId) ?? []
    const sessionsWithQuestion = sessionsForRespondent.filter((session) => session.questionIds.includes(questionId))
    const filledSession = sessionsWithQuestion.find((session) =>
      answers.some(
        (answer) => answer.sessionId === session.id && answer.questionId === questionId && answer.text.trim().length > 0,
      ),
    )
    const session = filledSession ?? sessionsWithQuestion[0] ?? null
    const answer = session
      ? answers.find((item) => item.sessionId === session.id && item.questionId === questionId) ?? null
      : null
    return {
      answer: answer && answer.text.trim().length > 0 ? answer : null,
      sessionId: session?.id ?? null,
      sessionDate: session?.interviewDate ?? null,
    }
  }

  const rows = useMemo(() => {
    return respondents.map((respondent) => {
      const cells = new Map<string, MatrixCell>()
      for (const question of filteredQuestions) {
        cells.set(question.id, resolveCell(respondent.id, question.id))
      }
      const visible = filteredQuestions.filter((question) => {
        const cell = cells.get(question.id)
        return onlyAnswered ? Boolean(cell?.answer) : true
      })
      return { respondent, cells, visible }
    })
  }, [respondents, filteredQuestions, onlyAnswered, answers, rowSessions])

  const columnQuestions = useMemo(() => {
    const ids = new Set<string>()
    for (const row of rows) for (const question of row.visible) ids.add(question.id)
    return filteredQuestions.filter((question) => ids.has(question.id))
  }, [rows, filteredQuestions])

  const filledCells = rows.reduce((total, row) => {
    return total + columnQuestions.filter((question) => row.cells.get(question.id)?.answer).length
  }, 0)
  const totalCells = rows.length * columnQuestions.length

  if (respondents.length === 0 || questions.length === 0) {
    return (
      <EmptyState
        icon={respondents.length === 0 ? 'people' : 'guide'}
        title={respondents.length === 0 ? 'Belum ada narasumber' : 'Belum ada pertanyaan aktif'}
        description={
          respondents.length === 0
            ? 'Tambahkan narasumber lalu catat sesi agar jawaban dapat dibandingkan.'
            : 'Susun pertanyaan pada panduan agar perbandingan jawaban dapat ditampilkan.'
        }
        action={
          <Link to={`/p/${projectId}/${respondents.length === 0 ? 'narasumber' : 'panduan'}`}>
            <Button variant="primary">{respondents.length === 0 ? 'Tambah narasumber' : 'Buka panduan'}</Button>
          </Link>
        }
      />
    )
  }

  if (sessions.length === 0) {
    return (
      <EmptyState
        icon="session"
        title="Belum ada sesi wawancara"
        description="Perbandingan memakai jawaban dari sesi yang sudah dicatat. Buat sesi pertama untuk mulai mengisi jawaban."
        action={
          <Link to={`/p/${projectId}/sesi?baru=1`}>
            <Button variant="primary" icon="plus">
              Buat sesi
            </Button>
          </Link>
        }
      />
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded-[12px] border border-line bg-surface px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-[15px] font-semibold text-ink">Matriks jawaban</h2>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-ink-muted">
              Baris berisi narasumber, kolom berisi pertanyaan. Bila satu narasumber punya beberapa sesi, sel menampilkan
              jawaban terbaru yang terisi. Klik sel untuk membuka sesi dan pertanyaannya.
            </p>
          </div>
          <Badge tone={filledCells === totalCells && totalCells > 0 ? 'success' : 'neutral'}>
            {filledCells}/{totalCells} sel terisi
          </Badge>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
          <div>
            <label htmlFor="matriks-bagian" className="mb-1 block text-[11px] font-medium text-ink-muted">
              Bagian
            </label>
            <Select id="matriks-bagian" value={sectionFilter} onChange={(event) => setSectionFilter(event.target.value)}>
              <option value="semua">Semua bagian</option>
              {sections.map((section) => (
                <option key={section.id} value={section.id}>
                  {section.title}
                </option>
              ))}
              <option value="tanpa">Tanpa bagian</option>
            </Select>
          </div>
          <div>
            <label htmlFor="matriks-cari" className="mb-1 block text-[11px] font-medium text-ink-muted">
              Cari pertanyaan
            </label>
            <input
              id="matriks-cari"
              type="search"
              value={questionFilter}
              onChange={(event) => setQuestionFilter(event.target.value)}
              placeholder="Kata kunci pertanyaan…"
              className="h-11 w-full rounded-[9px] border border-line-strong bg-surface px-3 text-sm text-ink placeholder:text-ink-muted focus:border-primary focus:shadow-[0_0_0_3px_var(--primary-soft)] focus:outline-none"
            />
          </div>
          <div className="sm:col-span-2 lg:col-span-1">
            <Switch
              checked={onlyAnswered}
              onChange={setOnlyAnswered}
              label="Hanya pertanyaan berjawaban"
              description="Sembunyikan kolom tanpa jawaban terisi."
            />
          </div>
        </div>
      </div>

      {columnQuestions.length === 0 ? (
        <EmptyState
          icon="search"
          title="Tidak ada pertanyaan yang cocok"
          description="Ubah kata kunci, bagian, atau matikan filter hanya pertanyaan berjawaban."
          action={
            <Button
              variant="secondary"
              onClick={() => {
                setQuestionFilter('')
                setSectionFilter('semua')
                setOnlyAnswered(false)
              }}
            >
              Reset filter
            </Button>
          }
        />
      ) : (
        <div className="rounded-[12px] border border-line bg-surface">
          <div className="overflow-x-auto">
            <table className="w-full min-w-max border-collapse text-left">
              <caption className="sr-only">
                Perbandingan jawaban narasumber terhadap pertanyaan. Gunakan scroll horizontal untuk melihat semua kolom.
              </caption>
              <thead>
                <tr className="border-b border-line bg-surface-2/60">
                  <th
                    scope="col"
                    className="sticky left-0 z-10 min-w-[190px] border-r border-line bg-surface-2 px-3 py-2.5 align-bottom text-[11px] font-semibold uppercase tracking-wide text-ink-muted"
                  >
                    Narasumber
                  </th>
                  {columnQuestions.map((question, index) => (
                    <th
                      key={question.id}
                      scope="col"
                      className="min-w-[210px] max-w-[240px] border-r border-line px-3 py-2.5 align-bottom last:border-r-0"
                    >
                      <span className="mono-meta block text-accent">P{String(index + 1).padStart(2, '0')}</span>
                      <span className="mt-1 line-clamp-3 block text-[11.5px] font-medium leading-snug text-ink">
                        {question.text}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(({ respondent, cells }) => (
                  <tr key={respondent.id} className="border-b border-line last:border-b-0">
                    <th
                      scope="row"
                      className="sticky left-0 z-10 border-r border-line bg-surface px-3 py-3 text-left align-top"
                    >
                      <span className="mono-meta block text-ink-muted">{respondent.code}</span>
                      <span className="mt-0.5 block text-[13px] font-semibold leading-snug text-ink">
                        {respondent.displayName || 'Tanpa nama'}
                      </span>
                      {respondent.archivedAt ? (
                        <Badge tone="neutral" className="mt-1">
                          Diarsipkan
                        </Badge>
                      ) : null}
                    </th>
                    {columnQuestions.map((question) => {
                      const cell = cells.get(question.id) ?? { answer: null, sessionId: null, sessionDate: null }
                      return (
                        <td key={question.id} className="border-r border-line px-3 py-3 align-top last:border-r-0">
                          {cell.sessionId ? (
                            <Link
                              to={`/p/${projectId}/sesi/${cell.sessionId}?q=${question.id}`}
                              className="block rounded-[7px] p-1 -m-1 transition-colors hover:bg-surface-2"
                            >
                              <CellContent cell={cell} />
                            </Link>
                          ) : (
                            <CellContent cell={cell} />
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center gap-3 border-t border-line px-4 py-2.5 text-[11px] text-ink-muted">
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-line-strong" aria-hidden="true" />
              Belum dijawab
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden="true" />
              Terisi
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-warn" aria-hidden="true" />
              Perlu klarifikasi
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-info" aria-hidden="true" />
              Ditinjau
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

export function Analysis() {
  const project = useProject()
  const { data } = useWorkspace()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()

  usePageTitle(project ? `Analisis · ${project.title}` : 'Analisis')

  const rawTab = params.get('tab')
  const tab: TabId = isTabId(rawTab) ? rawTab : 'ringkasan'
  const setTab = (next: string) => {
    const updated = new URLSearchParams(params)
    if (next === 'ringkasan') updated.delete('tab')
    else updated.set('tab', next)
    setParams(updated, { replace: true })
  }

  const summary = useMemo(() => {
    if (!project) return null
    const sessions = projectSessions(data, project.id)
    const respondents = projectRespondents(data, project.id)
    const questions = projectQuestions(data, project.id)
    const sessionIds = new Set(sessions.map((session) => session.id))
    const answers = data.answers.filter((answer) => sessionIds.has(answer.sessionId))
    const filled = answers.filter((answer) => answer.text.trim().length > 0)
    const codes = data.codes.filter((code) => code.projectId === project.id)
    const categories = data.categories.filter((category) => category.projectId === project.id)
    const themes = data.themes.filter((theme) => theme.projectId === project.id)
    const issues = qualityIssues(data, project)
    const generalMemos = data.memos
      .filter((memo) => memo.projectId === project.id && memo.themeId === null)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    const distribution = statusDistribution(answers)
    const answeredQuestionIds = new Set(filled.map((answer) => answer.questionId))
    const totalSlots = answers.length
    const progressPercent = totalSlots === 0 ? 0 : Math.round((filled.length / totalSlots) * 100)
    return {
      sessions,
      respondents,
      questions,
      answers,
      filled,
      codes,
      categories,
      themes,
      issues,
      generalMemos,
      distribution,
      answeredQuestionIds,
      totalSlots,
      progressPercent,
    }
  }, [data, project])

  if (!project || !summary) {
    return (
      <EmptyState
        icon="folder"
        title="Proyek tidak ditemukan"
        description="Kembali ke dasbor untuk memilih proyek lain."
        action={
          <Link to="/">
            <Button variant="primary">Kembali ke dasbor</Button>
          </Link>
        }
      />
    )
  }

  const {
    sessions,
    respondents,
    questions,
    filled,
    codes,
    categories,
    themes,
    issues,
    generalMemos,
    distribution,
    answeredQuestionIds,
    totalSlots,
    progressPercent,
  } = summary

  const sections = [...data.sections]
    .filter((section) => section.projectId === project.id)
    .sort((a, b) => a.orderIndex - b.orderIndex)
  const unsectionedQuestions = questions.filter((question) => !question.sectionId || !sections.some((section) => section.id === question.sectionId))
  const sectionRows = [
    ...sections
      .map((section) => {
        const sectionQuestions = questions.filter((question) => question.sectionId === section.id)
        return {
          id: section.id,
          title: section.title,
          questions: sectionQuestions.length,
          answered: sectionQuestions.filter((question) => answeredQuestionIds.has(question.id)).length,
        }
      })
      .filter((row) => row.questions > 0),
    ...(unsectionedQuestions.length > 0
      ? [
          {
            id: 'tanpa-bagian',
            title: 'Tanpa bagian',
            questions: unsectionedQuestions.length,
            answered: unsectionedQuestions.filter((question) => answeredQuestionIds.has(question.id)).length,
          },
        ]
      : []),
  ]

  const tabs = [
    { id: 'ringkasan', label: 'Ringkasan' },
    { id: 'coding', label: 'Coding', count: codes.length },
    { id: 'tema', label: 'Kategori & tema', count: themes.length },
    { id: 'perbandingan', label: 'Perbandingan', count: respondents.length },
  ]

  const distributionTotal = Math.max(totalSlots, 1)

  return (
    <>
      <PageHeader
        breadcrumb={
          <>
            <Link to={`/p/${project.id}`} className="hover:text-ink">
              {project.title}
            </Link>
            <Icon name="chevronRight" size={12} />
            <span>Analisis</span>
          </>
        }
        title="Analisis"
        description="Hubungkan jawaban dengan kode, bentuk kategori dan tema, lalu bandingkan jawaban antar narasumber. Bagian ini menampilkan data yang sudah tercatat, bukan analisis otomatis."
        meta={
          <>
            <StatusBadge status={project.status} />
            <span className="mono-meta">{filled.length} jawaban terisi</span>
            <span className="text-line-strong">·</span>
            <span className="mono-meta">{codes.length} kode</span>
            <span className="text-line-strong">·</span>
            <span className="mono-meta">{themes.length} tema</span>
          </>
        }
        actions={
          <>
            <Button variant="secondary" icon="export" onClick={() => navigate(`/p/${project.id}/ekspor`)}>
              Ekspor hasil
            </Button>
            <Button variant="primary" icon="data" onClick={() => navigate(`/p/${project.id}/data`)}>
              Buka data jawaban
            </Button>
          </>
        }
      />

      <Tabs items={tabs} value={tab} onChange={setTab} label="Bagian analisis" className="mb-5" />

      {tab === 'coding' ? <AnalysisCoding projectId={project.id} /> : null}
      {tab === 'tema' ? <AnalysisThemes projectId={project.id} /> : null}
      {tab === 'perbandingan' ? (
        <ComparisonMatrix
          projectId={project.id}
          respondents={respondents}
          questions={questions}
          sessions={sessions}
          answers={summary.answers}
          sections={sections}
        />
      ) : null}

      {tab === 'ringkasan' ? (
        <div className="space-y-5">
          {sessions.length === 0 ? (
            <InlineNotice
              tone="info"
              title="Belum ada sesi untuk dianalisis"
              action={
                <Link to={`/p/${project.id}/sesi?baru=1`}>
                  <Button size="sm" variant="primary" icon="plus">
                    Buat sesi
                  </Button>
                </Link>
              }
            >
              Analisis bekerja dari jawaban yang tersimpan pada sesi wawancara. Buat sesi dan isi jawaban terlebih dahulu.
            </InlineNotice>
          ) : null}

          <section aria-label="Statistik analisis" className="grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4">
            <Metric
              label="Narasumber"
              value={String(respondents.length)}
              detail={`${sessions.length} sesi aktif, ${sessions.filter((session) => session.status === 'Selesai').length} selesai`}
            />
            <Metric
              label="Jawaban terisi"
              value={`${filled.length}/${totalSlots}`}
              detail={`${progressPercent}% slot jawaban pada sesi aktif`}
            />
            <Metric
              label="Kode"
              value={String(codes.length)}
              detail={`${categories.length} kategori, ${data.answerCodes.filter((item) => item.projectId === project.id).length} penerapan`}
            />
            <Metric
              label="Tema"
              value={String(themes.length)}
              detail={`${themes.filter((theme) => evidenceForTheme(data, theme.id).length > 0).length} tema punya bukti`}
            />
          </section>

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
            <div className="min-w-0 space-y-5">
              <section className="rounded-[12px] border border-line bg-surface px-4 py-4 sm:px-5" aria-labelledby="sebaran-jawaban">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 id="sebaran-jawaban" className="text-[15px] font-semibold text-ink">
                      Sebaran status jawaban
                    </h2>
                    <p className="mt-0.5 text-xs text-ink-muted">
                      Dihitung dari {totalSlots} slot jawaban pada sesi aktif.
                    </p>
                  </div>
                  <Badge tone={progressPercent === 100 ? 'success' : progressPercent === 0 ? 'neutral' : 'primary'}>
                    {progressPercent}% terisi
                  </Badge>
                </div>

                {totalSlots === 0 ? (
                  <p className="mt-4 rounded-[9px] border border-dashed border-line-strong px-3 py-4 text-center text-xs text-ink-muted">
                    Belum ada slot jawaban. Sesi baru akan membuat slot sesuai pertanyaan aktif.
                  </p>
                ) : (
                  <>
                    <div className="mt-3 flex h-2.5 w-full overflow-hidden rounded-full bg-surface-3" aria-hidden="true">
                      {DISTRIBUTION_ORDER.map((item) => {
                        const value = distribution[item.key]
                        if (value === 0) return null
                        return (
                          <span
                            key={item.key}
                            className={item.bar}
                            style={{ width: `${(value / distributionTotal) * 100}%` }}
                          />
                        )
                      })}
                    </div>
                    <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
                      {DISTRIBUTION_ORDER.map((item) => (
                        <div key={item.key} className="flex items-start gap-2">
                          <span className={cx('mt-1 h-2 w-2 shrink-0 rounded-full', item.swatch)} aria-hidden="true" />
                          <div>
                            <dt className="text-[11px] leading-snug text-ink-muted">{item.label}</dt>
                            <dd className="mono-meta text-[13px] font-medium text-ink">{distribution[item.key]}</dd>
                          </div>
                        </div>
                      ))}
                    </dl>
                  </>
                )}
              </section>

              <section className="rounded-[12px] border border-line bg-surface px-4 py-4 sm:px-5" aria-labelledby="cakupan-bagian">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 id="cakupan-bagian" className="text-[15px] font-semibold text-ink">
                      Cakupan per bagian
                    </h2>
                    <p className="mt-0.5 text-xs text-ink-muted">
                      Pertanyaan yang sudah memiliki minimal satu jawaban terisi.
                    </p>
                  </div>
                  <Link
                    to={`/p/${project.id}/panduan`}
                    className="inline-flex min-h-8 items-center gap-1 rounded px-1 text-xs font-medium text-primary hover:underline"
                  >
                    Buka panduan
                    <Icon name="chevronRight" size={12} />
                  </Link>
                </div>

                {sectionRows.length === 0 ? (
                  <div className="mt-4 rounded-[9px] border border-dashed border-line-strong px-3 py-5 text-center">
                    <p className="text-[13px] font-medium text-ink">Belum ada pertanyaan aktif</p>
                    <p className="mt-1 text-xs text-ink-muted">Susun panduan agar cakupan jawaban dapat dihitung.</p>
                    <Link to={`/p/${project.id}/panduan?tambah=1`} className="mt-3 inline-block">
                      <Button size="sm" variant="secondary" icon="plus">
                        Tambah pertanyaan
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <ul className="mt-3 divide-y divide-line">
                    {sectionRows.map((row) => {
                      const percent = row.questions === 0 ? 0 : Math.round((row.answered / row.questions) * 100)
                      return (
                        <li key={row.id} className="py-3 first:pt-0 last:pb-0">
                          <div className="flex items-center justify-between gap-3">
                            <p className="min-w-0 truncate text-[13px] font-medium text-ink">{row.title}</p>
                            <span className="mono-meta shrink-0 text-ink-muted">
                              {row.answered}/{row.questions} terjawab
                            </span>
                          </div>
                          <Progress
                            value={percent}
                            className="mt-2"
                            tone={percent === 100 ? 'success' : 'primary'}
                            label={`Cakupan bagian ${row.title}`}
                          />
                        </li>
                      )
                    })}
                  </ul>
                )}
              </section>

              <section className="rounded-[12px] border border-line bg-surface px-4 py-4 sm:px-5" aria-labelledby="pemeriksaan-analisis">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 id="pemeriksaan-analisis" className="text-[15px] font-semibold text-ink">
                      Pemeriksaan keterhubungan
                    </h2>
                    <p className="mt-0.5 text-xs text-ink-muted">
                      Memeriksa jawaban, coding, dan bukti tema yang tidak lagi terhubung.
                    </p>
                  </div>
                  <Badge tone={issues.length === 0 ? 'success' : issues.some((issue) => issue.severity === 'penting') ? 'danger' : 'warn'}>
                    {issues.length === 0 ? 'Bersih' : `${issues.length} temuan`}
                  </Badge>
                </div>
                {issues.length === 0 ? (
                  <InlineNotice tone="success" className="mt-3">
                    Tidak ada masalah keterhubungan yang terdeteksi pada data saat ini.
                  </InlineNotice>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {issues.map((issue) => {
                      const target = issueTarget(issue.id, issue.link)
                      return (
                        <li key={issue.id} className="flex flex-col gap-2 rounded-[9px] border border-line bg-surface-2/40 px-3 py-2.5 sm:flex-row sm:items-start">
                          <Badge tone={issue.severity === 'penting' ? 'danger' : 'warn'} className="self-start">
                            {issue.severity === 'penting' ? 'Penting' : 'Perhatian'}
                          </Badge>
                          <div className="min-w-0 flex-1">
                            <p className="text-[13px] font-medium text-ink">{issue.label}</p>
                            <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">{issue.detail}</p>
                          </div>
                          {target ? (
                            <Link
                              to={target}
                              className="inline-flex min-h-8 shrink-0 items-center gap-1 self-start rounded px-1 text-xs font-medium text-primary hover:underline"
                            >
                              Tinjau
                              <Icon name="chevronRight" size={12} />
                            </Link>
                          ) : null}
                        </li>
                      )
                    })}
                  </ul>
                )}
              </section>

              <section className="rounded-[12px] border border-line bg-surface px-4 py-4 sm:px-5" aria-labelledby="ikhtisar-tema">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 id="ikhtisar-tema" className="text-[15px] font-semibold text-ink">
                      Ikhtisar tema
                    </h2>
                    <p className="mt-0.5 text-xs text-ink-muted">
                      Tema adalah interpretasi peneliti. Bukti menjaga tiap tema tetap dapat ditelusuri.
                    </p>
                  </div>
                  <Button size="sm" variant="secondary" icon="layers" onClick={() => setTab('tema')}>
                    Kelola tema
                  </Button>
                </div>

                {themes.length === 0 ? (
                  <div className="mt-4 rounded-[9px] border border-dashed border-line-strong px-3 py-5 text-center">
                    <p className="text-[13px] font-medium text-ink">Belum ada tema</p>
                    <p className="mt-1 text-xs text-ink-muted">
                      Mulai dari coding, kelompokkan kode menjadi kategori, lalu bentuk tema.
                    </p>
                    <div className="mt-3 flex flex-wrap justify-center gap-2">
                      <Button size="sm" variant="secondary" onClick={() => setTab('coding')}>
                        Buka coding
                      </Button>
                      <Button size="sm" variant="primary" onClick={() => setTab('tema')}>
                        Buat tema
                      </Button>
                    </div>
                  </div>
                ) : (
                  <ul className="mt-3 divide-y divide-line">
                    {themes.map((theme) => {
                      const evidence = evidenceForTheme(data, theme.id)
                      const themeCategories = categoriesForTheme(data, theme.id)
                      return (
                        <li key={theme.id} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <p className="text-[13px] font-semibold text-ink">{theme.name}</p>
                            <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-ink-muted">
                              {theme.description || theme.interpretation || 'Belum ada deskripsi atau interpretasi.'}
                            </p>
                            {themeCategories.length > 0 ? (
                              <div className="mt-1.5 flex flex-wrap gap-1">
                                {themeCategories.map((category) => (
                                  <Badge key={category.id} tone="neutral">
                                    {category.name}
                                  </Badge>
                                ))}
                              </div>
                            ) : null}
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <Badge tone={evidence.length > 0 ? 'success' : 'warn'}>
                              {evidence.length} bukti
                            </Badge>
                            <button
                              type="button"
                              onClick={() => setTab('tema')}
                              className="inline-flex min-h-8 items-center gap-1 rounded px-1 text-xs font-medium text-primary hover:underline"
                            >
                              Buka
                              <Icon name="chevronRight" size={12} />
                            </button>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </section>
            </div>

            <aside className="space-y-4">
              <section className="rounded-[12px] border border-line bg-surface px-4 py-4" aria-labelledby="memo-umum">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 id="memo-umum" className="text-[13px] font-semibold text-ink">
                      Memo umum
                    </h2>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-ink-muted">
                      Catatan yang tidak terikat pada satu tema.
                    </p>
                  </div>
                  <Badge tone="neutral">{generalMemos.length}</Badge>
                </div>
                {generalMemos.length === 0 ? (
                  <p className="mt-3 rounded-[8px] border border-dashed border-line-strong px-3 py-3 text-[11px] leading-relaxed text-ink-muted">
                    Belum ada memo umum. Tambahkan dari tab Kategori & tema.
                  </p>
                ) : (
                  <ul className="mt-2.5 space-y-2.5">
                    {generalMemos.slice(0, 3).map((memo) => (
                      <li key={memo.id} className="rounded-[8px] bg-surface-2/70 px-3 py-2">
                        <p className="line-clamp-4 text-[11.5px] leading-relaxed text-ink-soft">{memo.content}</p>
                        <p className="mono-meta mt-1 text-ink-muted">{formatDate(memo.createdAt, true)}</p>
                      </li>
                    ))}
                  </ul>
                )}
                <Button
                  size="sm"
                  variant="secondary"
                  icon="note"
                  className="mt-3 w-full"
                  onClick={() => setTab('tema')}
                >
                  {generalMemos.length > 0 ? 'Kelola memo' : 'Tambah memo umum'}
                </Button>
              </section>

              <section className="rounded-[12px] border border-line bg-surface px-4 py-4" aria-labelledby="progres-sesi">
                <h2 id="progres-sesi" className="text-[13px] font-semibold text-ink">
                  Progres sesi
                </h2>
                {sessions.length === 0 ? (
                  <p className="mt-2 text-[11px] leading-relaxed text-ink-muted">
                    Belum ada sesi aktif untuk dihitung.
                  </p>
                ) : (
                  <ul className="mt-2.5 space-y-3">
                    {sessions.slice(0, 5).map((session) => {
                      const progress = sessionProgress(data, session)
                      const respondent = data.respondents.find((item) => item.id === session.respondentId)
                      return (
                        <li key={session.id}>
                          <Link
                            to={`/p/${project.id}/sesi/${session.id}`}
                            className="group block rounded-md p-1 -m-1 transition-colors hover:bg-surface-2"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <p className="min-w-0 truncate text-[11.5px] font-medium text-ink group-hover:text-primary">
                                {respondent ? respondent.code : 'Narasumber'} · {session.title}
                              </p>
                              <span className="mono-meta shrink-0 text-ink-muted">
                                {progress.answered}/{progress.total}
                              </span>
                            </div>
                            <Progress
                              value={progress.percent}
                              className="mt-1.5"
                              label={`Progres ${session.title}`}
                              tone={progress.percent === 100 ? 'success' : 'primary'}
                            />
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                )}
                {sessions.length > 5 ? (
                  <Link
                    to={`/p/${project.id}/sesi`}
                    className="mt-3 inline-flex min-h-8 items-center gap-1 rounded px-1 text-xs font-medium text-primary hover:underline"
                  >
                    Lihat semua sesi
                    <Icon name="chevronRight" size={12} />
                  </Link>
                ) : null}
              </section>

              <section className="rounded-[12px] border border-line bg-surface-2/50 px-4 py-3.5">
                <p className="mono-meta uppercase text-ink-muted">Cara kerja</p>
                <p className="mt-1 text-[11px] leading-relaxed text-ink-muted">
                  Aplikasi tidak membuat kode, kategori, atau tema secara otomatis. Semua penanda analisis dibuat dan
                  diperiksa oleh peneliti.
                </p>
              </section>
            </aside>
          </div>
        </div>
      ) : null}
    </>
  )
}
