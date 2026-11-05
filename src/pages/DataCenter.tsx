import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { usePageTitle, useProject } from '../lib/hooks'
import { useWorkspace } from '../lib/store'
import type { AnswerStatus } from '../lib/types'
import { ANSWER_STATUSES } from '../lib/types'
import {
  projectAnswers,
  projectQuestions,
  projectRespondents,
  projectSessions,
} from '../lib/selectors'
import { formatDate } from '../lib/utils'
import { Icon } from '../components/Icon'
import {
  Badge,
  Button,
  EmptyState,
  InlineNotice,
  PageHeader,
  SearchInput,
  Select,
  StatusBadge,
  Tabs,
  cx,
} from '../components/ui'

type ViewMode = 'tabel' | 'narasumber' | 'pertanyaan'

const PAGE_SIZE = 20

export function DataCenter() {
  const project = useProject()
  const { data } = useWorkspace()
  usePageTitle('Data jawaban')

  const [view, setView] = useState<ViewMode>('tabel')
  const [query, setQuery] = useState('')
  const [respondentFilter, setRespondentFilter] = useState('Semua')
  const [sessionFilter, setSessionFilter] = useState('Semua')
  const [statusFilter, setStatusFilter] = useState('Semua')
  const [onlyFilled, setOnlyFilled] = useState(true)
  const [page, setPage] = useState(1)
  const [expandedQuestion, setExpandedQuestion] = useState<string | null>(null)

  useEffect(() => {
    setPage(1)
  }, [query, respondentFilter, sessionFilter, statusFilter, onlyFilled, view])

  const model = useMemo(() => {
    if (!project) return null
    const sessions = projectSessions(data, project.id, true).sort(
      (a, b) => new Date(b.interviewDate).getTime() - new Date(a.interviewDate).getTime(),
    )
    const respondents = projectRespondents(data, project.id, true)
    const questions = projectQuestions(data, project.id, true)
    const answers = projectAnswers(data, project.id)
    return {
      sessions,
      respondents,
      questions,
      answers,
      sessionMap: new Map(sessions.map((session) => [session.id, session])),
      respondentMap: new Map(respondents.map((respondent) => [respondent.id, respondent])),
      questionMap: new Map(questions.map((question) => [question.id, question])),
      sectionMap: new Map(data.sections.filter((section) => section.projectId === project.id).map((section) => [section.id, section])),
    }
  }, [data, project])

  const rows = useMemo(() => {
    if (!model) return []
    const needle = query.trim().toLowerCase()
    return model.answers
      .map((answer) => {
        const session = model.sessionMap.get(answer.sessionId)
        const question = model.questionMap.get(answer.questionId)
        const respondent = session ? model.respondentMap.get(session.respondentId) : undefined
        const section = question?.sectionId ? model.sectionMap.get(question.sectionId) : undefined
        return { answer, session, question, respondent, section }
      })
      .filter((row) => {
        if (!row.session || !row.question) return false
        if (onlyFilled && row.answer.text.trim().length === 0) return false
        if (statusFilter !== 'Semua' && row.answer.status !== statusFilter) return false
        if (respondentFilter !== 'Semua' && row.session.respondentId !== respondentFilter) return false
        if (sessionFilter !== 'Semua' && row.session.id !== sessionFilter) return false
        if (!needle) return true
        return [
          row.answer.text,
          row.answer.interviewerNotes,
          row.question.text,
          row.question.guidance,
          row.respondent?.code ?? '',
          row.respondent?.displayName ?? '',
        ]
          .join(' ')
          .toLowerCase()
          .includes(needle)
      })
      .sort((a, b) => {
        const dateDiff = new Date(b.session!.interviewDate).getTime() - new Date(a.session!.interviewDate).getTime()
        if (dateDiff !== 0) return dateDiff
        return (a.question?.orderIndex ?? 0) - (b.question?.orderIndex ?? 0)
      })
  }, [model, query, respondentFilter, sessionFilter, statusFilter, onlyFilled])

  if (!project || !model) return null

  const filledAnswers = model.answers.filter((answer) => answer.text.trim().length > 0)
  const codedAnswerIds = new Set(data.answerCodes.filter((link) => link.projectId === project.id).map((link) => link.answerId))
  const unresolved = model.answers.filter(
    (answer) => answer.status === 'Perlu Klarifikasi' || (answer.text.trim().length === 0 && answer.status !== 'Belum Dijawab'),
  )
  const hasFilter = query.trim() !== '' || respondentFilter !== 'Semua' || sessionFilter !== 'Semua' || statusFilter !== 'Semua' || !onlyFilled
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pageRows = rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  const respondentOptions = model.respondents
    .filter((respondent) => respondentFilter === 'Semua' || respondent.id === respondentFilter)
    .sort((a, b) => a.code.localeCompare(b.code, 'id'))
  const sessionOptions = model.sessions.filter(
    (session) => respondentFilter === 'Semua' || session.respondentId === respondentFilter,
  )

  const resetFilters = () => {
    setQuery('')
    setRespondentFilter('Semua')
    setSessionFilter('Semua')
    setStatusFilter('Semua')
    setOnlyFilled(true)
  }

  const respondentSummary = model.respondents
    .map((respondent) => {
      const respondentSessions = model.sessions.filter((session) => session.respondentId === respondent.id)
      const sessionIds = new Set(respondentSessions.map((session) => session.id))
      const respondentAnswers = model.answers.filter((answer) => sessionIds.has(answer.sessionId))
      const respondentFilled = respondentAnswers.filter((answer) => answer.text.trim().length > 0)
      const respondentCoded = respondentFilled.filter((answer) => codedAnswerIds.has(answer.id))
      return { respondent, sessions: respondentSessions, answers: respondentAnswers, filled: respondentFilled, coded: respondentCoded }
    })
    .filter((item) => {
      if (respondentFilter !== 'Semua' && item.respondent.id !== respondentFilter) return false
      if (sessionFilter !== 'Semua' && !item.sessions.some((session) => session.id === sessionFilter)) return false
      const needle = query.trim().toLowerCase()
      if (!needle) return true
      return [item.respondent.code, item.respondent.displayName, item.respondent.profileNotes]
        .join(' ')
        .toLowerCase()
        .includes(needle)
    })
    .sort((a, b) => b.filled.length - a.filled.length || a.respondent.code.localeCompare(b.respondent.code, 'id'))

  const questionSummary = model.questions
    .map((question) => {
      const questionAnswers = model.answers.filter(
        (answer) =>
          answer.questionId === question.id &&
          (respondentFilter === 'Semua' || model.sessionMap.get(answer.sessionId)?.respondentId === respondentFilter) &&
          (sessionFilter === 'Semua' || answer.sessionId === sessionFilter) &&
          (statusFilter === 'Semua' || answer.status === statusFilter),
      )
      const filled = questionAnswers.filter((answer) => answer.text.trim().length > 0)
      return { question, answers: questionAnswers, filled }
    })
    .filter((item) => {
      if (onlyFilled && item.filled.length === 0) return false
      const needle = query.trim().toLowerCase()
      if (!needle) return true
      return [item.question.text, item.question.guidance, item.question.sectionId ? model.sectionMap.get(item.question.sectionId)?.title ?? '' : '']
        .join(' ')
        .toLowerCase()
        .includes(needle)
    })
    .sort((a, b) => a.question.orderIndex - b.question.orderIndex)

  return (
    <>
      <PageHeader
        title="Data jawaban"
        description="Telusuri seluruh jawaban yang tercatat, per narasumber, atau per pertanyaan. Gunakan tautan untuk membuka sesi saat jawaban diisi."
        meta={
          <>
            <Badge tone="primary">{filledAnswers.length} jawaban terisi</Badge>
            <span>{model.sessions.filter((session) => session.status !== 'Diarsipkan').length} sesi</span>
            <span className="text-line-strong">·</span>
            <span>{model.respondents.filter((respondent) => !respondent.archivedAt).length} narasumber aktif</span>
          </>
        }
        actions={
          <Link to={`/p/${project.id}/ekspor`}>
            <Button variant="secondary" icon="export">
              Ekspor data
            </Button>
          </Link>
        }
      />

      {unresolved.length > 0 ? (
        <InlineNotice
          tone="warn"
          className="mb-5"
          title={`${unresolved.length} jawaban perlu perhatian`}
          action={
            <Button size="sm" variant="secondary" onClick={() => setStatusFilter('Perlu Klarifikasi')}>
              Lihat yang perlu klarifikasi
            </Button>
          }
        >
          Sebagian jawaban ditandai perlu klarifikasi atau berstatus terisi tetapi teksnya kosong. Data tetap ditampilkan
          apa adanya, tanpa diubah otomatis.
        </InlineNotice>
      ) : null}

      <Tabs
        label="Tampilan data jawaban"
        value={view}
        onChange={(value) => setView(value as ViewMode)}
        items={[
          { id: 'tabel', label: 'Tabel jawaban', count: rows.length },
          { id: 'narasumber', label: 'Per narasumber', count: respondentSummary.length },
          { id: 'pertanyaan', label: 'Per pertanyaan', count: questionSummary.length },
        ]}
        className="mb-4"
      />

      <section className="rounded-[12px] border border-line bg-surface" aria-label="Filter data jawaban">
        <div className="flex flex-col gap-3 px-4 py-3.5 sm:px-5">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_11rem_11rem_11rem]">
            <SearchInput
              value={query}
              onChange={setQuery}
              placeholder="Cari jawaban, pertanyaan, atau narasumber…"
              className="sm:col-span-2 lg:col-span-1"
            />
            <Select
              value={respondentFilter}
              onChange={(event) => {
                setRespondentFilter(event.target.value)
                setSessionFilter('Semua')
              }}
              aria-label="Filter narasumber"
              className="text-[13px]"
            >
              <option value="Semua">Semua narasumber</option>
              {respondentOptions.map((respondent) => (
                <option key={respondent.id} value={respondent.id}>
                  {respondent.code}
                  {respondent.displayName ? ` · ${respondent.displayName}` : ''}
                  {respondent.archivedAt ? ' (arsip)' : ''}
                </option>
              ))}
            </Select>
            <Select
              value={sessionFilter}
              onChange={(event) => setSessionFilter(event.target.value)}
              aria-label="Filter sesi"
              className="text-[13px]"
            >
              <option value="Semua">Semua sesi</option>
              {sessionOptions.map((session) => (
                <option key={session.id} value={session.id}>
                  {session.title}
                  {session.status === 'Diarsipkan' ? ' (arsip)' : ''}
                </option>
              ))}
            </Select>
            <Select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as AnswerStatus | 'Semua')}
              aria-label="Filter status jawaban"
              className="text-[13px]"
            >
              <option value="Semua">Semua status</option>
              {ANSWER_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="flex min-h-9 items-center gap-2 text-xs text-ink-soft">
              <input
                type="checkbox"
                checked={onlyFilled}
                onChange={(event) => setOnlyFilled(event.target.checked)}
                className="h-4 w-4 rounded border-line-strong accent-[var(--primary)]"
              />
              Hanya tampilkan jawaban yang terisi
            </label>
            {hasFilter ? (
              <Button size="sm" variant="ghost" icon="refresh" onClick={resetFilters}>
                Reset filter
              </Button>
            ) : (
              <span className="text-[11px] text-ink-muted">{model.answers.length} slot jawaban tercatat</span>
            )}
          </div>
        </div>
      </section>

      {view === 'tabel' ? (
        <section className="mt-4 overflow-hidden rounded-[12px] border border-line bg-surface" aria-label="Tabel jawaban">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3 sm:px-5">
            <div>
              <h2 className="text-[15px] font-semibold text-ink">Tabel jawaban</h2>
              <p className="mt-0.5 text-xs text-ink-muted">
                {rows.length === 0
                  ? 'Tidak ada baris yang cocok dengan filter.'
                  : `Menampilkan ${(safePage - 1) * PAGE_SIZE + 1} sampai ${Math.min(safePage * PAGE_SIZE, rows.length)} dari ${rows.length} baris.`}
              </p>
            </div>
            <span className="mono-meta text-ink-muted">{codedAnswerIds.size} jawaban terkode</span>
          </div>

          {rows.length === 0 ? (
            <div className="p-4 sm:p-5">
              <EmptyState
                icon={model.answers.length === 0 ? 'session' : 'search'}
                title={model.answers.length === 0 ? 'Belum ada jawaban tercatat' : 'Tidak ada jawaban yang cocok'}
                description={
                  model.answers.length === 0
                    ? 'Buat sesi wawancara dan isi jawaban. Setiap jawaban yang tersimpan akan muncul di sini.'
                    : 'Ubah kata kunci atau filter untuk melihat jawaban lain. Filter “hanya terisi” juga dapat dimatikan.'
                }
                action={
                  model.answers.length === 0 ? (
                    <Link to={`/p/${project.id}/sesi`}>
                      <Button variant="primary" icon="session">
                        Buka sesi wawancara
                      </Button>
                    </Link>
                  ) : (
                    <Button variant="secondary" onClick={resetFilters}>
                      Reset filter
                    </Button>
                  )
                }
              />
            </div>
          ) : (
            <>
              <ul className="divide-y divide-line">
                {pageRows.map((row) => (
                  <li key={row.answer.id} className="px-4 py-4 transition-colors hover:bg-surface-2/30 sm:px-5">
                    <div className="flex flex-col gap-2.5 lg:flex-row lg:items-start lg:gap-5">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="mono-meta rounded bg-surface-2 px-1.5 py-0.5 text-ink-soft">
                            {row.respondent?.code ?? 'Tanpa kode'}
                          </span>
                          {row.respondent?.displayName ? (
                            <span className="text-[12px] text-ink-muted">{row.respondent.displayName}</span>
                          ) : null}
                          <StatusBadge status={row.answer.status} />
                          {codedAnswerIds.has(row.answer.id) ? (
                            <Badge tone="info" className="gap-1">
                              <Icon name="tag" size={11} />
                              Terkode
                            </Badge>
                          ) : null}
                        </div>
                        <p className="mt-1.5 line-clamp-2 text-[13px] font-semibold leading-snug text-ink">{row.question?.text}</p>
                        <p className="mt-1 text-[11px] text-ink-muted">
                          {row.section ? `${row.section.title} · ` : ''}
                          {formatDate(row.session?.interviewDate)} · {row.session?.title}
                        </p>
                        {row.answer.text.trim() ? (
                          <p className="mt-2 line-clamp-3 border-l-2 border-primary/25 pl-3 text-[13px] leading-relaxed text-ink-soft">
                            {row.answer.text}
                          </p>
                        ) : (
                          <p className="mt-2 text-xs italic text-ink-muted">Jawaban masih kosong.</p>
                        )}
                        {row.answer.interviewerNotes ? (
                          <p className="mt-1 text-[11px] text-ink-muted">Catatan: {row.answer.interviewerNotes}</p>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 items-center justify-between gap-2 lg:w-40 lg:flex-col lg:items-end">
                        <span className="text-[11px] text-ink-muted">Diubah {formatDate(row.answer.updatedAt, true)}</span>
                        <Link
                          to={`/p/${project.id}/sesi/${row.session?.id}?q=${row.question?.id}`}
                          className="inline-flex min-h-9 items-center gap-1.5 rounded-[8px] border border-line-strong bg-surface px-2.5 text-[12px] font-medium text-ink transition-colors hover:bg-surface-2 hover:border-ink-muted max-sm:h-11"
                        >
                          Buka jawaban
                          <Icon name="arrowRight" size={13} />
                        </Link>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
              {totalPages > 1 ? (
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3 sm:px-5">
                  <span className="text-xs text-ink-muted">
                    Halaman {safePage} dari {totalPages}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <Button size="sm" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={safePage === 1}>
                      Sebelumnya
                    </Button>
                    <Button size="sm" onClick={() => setPage((value) => Math.min(totalPages, value + 1))} disabled={safePage === totalPages}>
                      Berikutnya
                    </Button>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </section>
      ) : null}

      {view === 'narasumber' ? (
        <section className="mt-4" aria-label="Data per narasumber">
          {respondentSummary.length === 0 ? (
            <EmptyState
              icon="people"
              title="Tidak ada narasumber yang cocok"
              description="Ubah filter atau tambahkan narasumber pada proyek ini."
              action={
                <Link to={`/p/${project.id}/narasumber`}>
                  <Button variant="primary" icon="people">
                    Buka narasumber
                  </Button>
                </Link>
              }
            />
          ) : (
            <ul className="grid gap-3 lg:grid-cols-2">
              {respondentSummary.map((item) => {
                const totalSlots = item.answers.length
                const percent = totalSlots === 0 ? 0 : Math.round((item.filled.length / totalSlots) * 100)
                const latest = item.sessions[0]
                return (
                  <li key={item.respondent.id} className="rounded-[12px] border border-line bg-surface p-4 sm:p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-[15px] font-semibold text-ink">{item.respondent.code}</h3>
                          {item.respondent.archivedAt ? <Badge tone="neutral">Diarsipkan</Badge> : <Badge tone="success">Aktif</Badge>}
                        </div>
                        <p className="mt-0.5 text-[12px] text-ink-muted">{item.respondent.displayName || 'Nama tidak dicatat'}</p>
                      </div>
                      <span className="mono-meta text-ink-muted">{percent}%</span>
                    </div>
                    {item.respondent.profileNotes ? (
                      <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-ink-muted">{item.respondent.profileNotes}</p>
                    ) : null}
                    <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-line pt-3 text-center">
                      <div>
                        <dt className="mono-meta uppercase text-ink-muted">Sesi</dt>
                        <dd className="mt-0.5 text-sm font-semibold text-ink">{item.sessions.length}</dd>
                      </div>
                      <div>
                        <dt className="mono-meta uppercase text-ink-muted">Terisi</dt>
                        <dd className="mt-0.5 text-sm font-semibold text-ink">{item.filled.length}</dd>
                      </div>
                      <div>
                        <dt className="mono-meta uppercase text-ink-muted">Terkode</dt>
                        <dd className="mt-0.5 text-sm font-semibold text-ink">{item.coded.length}</dd>
                      </div>
                    </dl>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
                      <span className="text-[11px] text-ink-muted">
                        {latest ? `Sesi terakhir ${formatDate(latest.interviewDate)}` : 'Belum ada sesi'}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <Link
                          to={`/p/${project.id}/narasumber/${item.respondent.id}`}
                          className="inline-flex min-h-9 items-center gap-1 rounded-md px-2 text-[12px] font-medium text-primary hover:bg-primary-soft max-sm:h-11"
                        >
                          Profil
                        </Link>
                        {latest ? (
                          <Link
                            to={`/p/${project.id}/sesi/${latest.id}`}
                            className="inline-flex min-h-9 items-center gap-1 rounded-md border border-line-strong px-2.5 text-[12px] font-medium text-ink hover:bg-surface-2 max-sm:h-11"
                          >
                            Buka sesi
                            <Icon name="arrowRight" size={12} />
                          </Link>
                        ) : (
                          <Link
                            to={`/p/${project.id}/sesi?baru=1&narasumber=${item.respondent.id}`}
                            className="inline-flex min-h-9 items-center gap-1 rounded-md border border-line-strong px-2.5 text-[12px] font-medium text-ink hover:bg-surface-2 max-sm:h-11"
                          >
                            Buat sesi
                          </Link>
                        )}
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      ) : null}

      {view === 'pertanyaan' ? (
        <section className="mt-4 overflow-hidden rounded-[12px] border border-line bg-surface" aria-label="Data per pertanyaan">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3 sm:px-5">
            <div>
              <h2 className="text-[15px] font-semibold text-ink">Jawaban per pertanyaan</h2>
              <p className="mt-0.5 text-xs text-ink-muted">Buka satu pertanyaan untuk melihat kutipan dari setiap narasumber.</p>
            </div>
            <span className="mono-meta text-ink-muted">{questionSummary.length} pertanyaan</span>
          </div>
          {questionSummary.length === 0 ? (
            <div className="p-4 sm:p-5">
              <EmptyState
                icon="guide"
                title="Tidak ada pertanyaan yang cocok"
                description="Ubah filter atau periksa panduan pertanyaan proyek ini."
                action={
                  <Link to={`/p/${project.id}/panduan`}>
                    <Button variant="secondary" icon="guide">
                      Buka panduan
                    </Button>
                  </Link>
                }
              />
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {questionSummary.map((item) => {
                const open = expandedQuestion === item.question.id
                const section = item.question.sectionId ? model.sectionMap.get(item.question.sectionId) : undefined
                return (
                  <li key={item.question.id}>
                    <button
                      type="button"
                      onClick={() => setExpandedQuestion(open ? null : item.question.id)}
                      aria-expanded={open}
                      className="flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-surface-2/40 sm:px-5"
                    >
                      <span className="mono-meta mt-0.5 shrink-0 text-ink-muted">{String(item.question.orderIndex + 1).padStart(2, '0')}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13px] font-semibold leading-snug text-ink">{item.question.text}</span>
                        <span className="mt-0.5 block text-[11px] text-ink-muted">
                          {section?.title ?? 'Tanpa bagian'}
                          {!item.question.isActive ? ' · Nonaktif' : ''}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        <Badge tone={item.filled.length > 0 ? 'success' : 'neutral'}>{item.filled.length} jawaban</Badge>
                        <Icon name={open ? 'chevronDown' : 'chevronRight'} size={15} className="text-ink-muted" />
                      </span>
                    </button>
                    {open ? (
                      <div className="border-t border-line bg-surface-2/30 px-4 py-3 sm:px-5">
                        {item.filled.length === 0 ? (
                          <p className="text-xs text-ink-muted">Belum ada jawaban terisi untuk pertanyaan ini pada filter aktif.</p>
                        ) : (
                          <ul className="space-y-3">
                            {item.filled.map((answer) => {
                              const session = model.sessionMap.get(answer.sessionId)
                              const respondent = session ? model.respondentMap.get(session.respondentId) : undefined
                              return (
                                <li key={answer.id} className="rounded-[9px] border border-line bg-surface px-3.5 py-3">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="mono-meta rounded bg-surface-2 px-1.5 py-0.5 text-ink-soft">{respondent?.code ?? 'Tanpa kode'}</span>
                                    <span className="text-[11px] text-ink-muted">{formatDate(session?.interviewDate)}</span>
                                    <StatusBadge status={answer.status} />
                                    {session ? (
                                      <Link
                                        to={`/p/${project.id}/sesi/${session.id}?q=${item.question.id}`}
                                        className="ml-auto inline-flex min-h-8 items-center gap-1 rounded px-1 text-[11px] font-medium text-primary hover:underline"
                                      >
                                        Buka sesi
                                        <Icon name="chevronRight" size={11} />
                                      </Link>
                                    ) : null}
                                  </div>
                                  <p className="mt-2 whitespace-pre-line text-[13px] leading-relaxed text-ink-soft">{answer.text}</p>
                                  {answer.interviewerNotes ? (
                                    <p className="mt-1 text-[11px] text-ink-muted">Catatan pewawancara: {answer.interviewerNotes}</p>
                                  ) : null}
                                </li>
                              )
                            })}
                          </ul>
                        )}
                      </div>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      ) : null}

      <p className={cx('mt-4 text-[11px] leading-relaxed text-ink-muted')}>
        Perubahan pada tabel ini hanya untuk penelusuran. Untuk mengubah teks atau status jawaban, buka sesi terkait agar
        riwayat penyuntingan tetap tercatat pada jawaban tersebut.
      </p>
    </>
  )
}
