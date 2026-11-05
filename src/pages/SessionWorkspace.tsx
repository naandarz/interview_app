import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { usePageTitle, useProject } from '../lib/hooks'
import { useWorkspace } from '../lib/store'
import type { Answer, AnswerStatus, InterviewSession } from '../lib/types'
import { ANSWER_STATUSES, SESSION_STATUSES } from '../lib/types'
import { projectQuestions, questionById, sectionById, sessionProgress, sessionRespondent } from '../lib/selectors'
import { formatDate, formatDateLong, relativeTime } from '../lib/utils'
import { SessionDialog } from '../components/SessionDialog'
import { Icon } from '../components/Icon'
import {
  Badge,
  Button,
  ConfirmDialog,
  Drawer,
  EmptyState,
  Field,
  InlineNotice,
  PageHeader,
  Progress,
  SaveIndicator,
  SearchInput,
  Select,
  StatusBadge,
  Textarea,
  cx,
  useToast,
} from '../components/ui'

export function SessionWorkspace() {
  const project = useProject()
  const { sessionId } = useParams<{ sessionId: string }>()
  const { data, updateAnswer, updateSession, deleteSession, refreshSessionQuestions, saveState, retrySave } = useWorkspace()
  const { notify } = useToast()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const session = data.sessions.find((item) => item.id === sessionId && item.projectId === project?.id)
  usePageTitle(session?.title ?? 'Ruang sesi')

  const [currentId, setCurrentId] = useState('')
  const [query, setQuery] = useState('')
  const [listOpen, setListOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [completeOpen, setCompleteOpen] = useState(false)
  const [archiveOpen, setArchiveOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [sessionNotesDraft, setSessionNotesDraft] = useState('')
  const initialised = useRef(false)

  const questions = useMemo(() => {
    if (!session) return []
    return session.questionIds
      .map((id) => questionById(data, id))
      .filter((question): question is NonNullable<typeof question> => Boolean(question))
  }, [data, session])

  const progress = session ? sessionProgress(data, session) : { answered: 0, total: 0, percent: 0 }
  const respondent = session ? sessionRespondent(data, session) : undefined
  const readOnly = session?.status === 'Diarsipkan'

  const answersByQuestion = useMemo(() => {
    const map = new Map<string, Answer>()
    if (!session) return map
    for (const answer of data.answers) if (answer.sessionId === session.id) map.set(answer.questionId, answer)
    return map
  }, [data.answers, session])

  const activeQuestions = project ? projectQuestions(data, project.id) : []
  const newQuestionCount = session ? activeQuestions.filter((question) => !session.questionIds.includes(question.id)).length : 0

  useEffect(() => {
    if (!session || initialised.current) return
    initialised.current = true
    const requested = searchParams.get('q')
    const target = requested && session.questionIds.includes(requested) ? requested : ''
    const firstUnanswered = questions.find((question) => {
      const answer = answersByQuestion.get(question.id)
      return !answer || answer.text.trim().length === 0
    })
    setCurrentId(target || firstUnanswered?.id || questions[0]?.id || '')
    setSessionNotesDraft(session.notes)
  }, [session, questions, answersByQuestion, searchParams])

  useEffect(() => {
    if (!session) return
    setSessionNotesDraft(session.notes)
  }, [session?.id, session?.notes])

  useEffect(() => {
    if (!initialised.current || !session || questions.length === 0) return
    if (!questions.some((question) => question.id === currentId)) {
      setCurrentId(questions[0].id)
    }
  }, [questions, currentId, session])

  if (!project) return null

  if (!session) {
    return (
      <EmptyState
        icon="session"
        title="Sesi tidak ditemukan"
        description="Sesi ini mungkin sudah dihapus. Kembali ke daftar sesi untuk memilih sesi lain."
        action={
          <Link to={`/p/${project.id}/sesi`}>
            <Button variant="primary" icon="arrowLeft">
              Kembali ke sesi
            </Button>
          </Link>
        }
      />
    )
  }

  const currentIndex = questions.findIndex((question) => question.id === currentId)
  const current = questions[currentIndex]
  const currentAnswer = current ? answersByQuestion.get(current.id) : undefined
  const currentSection = current ? sectionById(data, current.sectionId) : undefined

  const filteredQuestions = questions.filter((question) => {
    const needle = query.trim().toLowerCase()
    if (!needle) return true
    return (
      question.text.toLowerCase().includes(needle) ||
      (question.sectionId ? sectionById(data, question.sectionId)?.title.toLowerCase().includes(needle) : false)
    )
  })

  const selectQuestion = (id: string) => {
    setCurrentId(id)
    setListOpen(false)
    const next = new URLSearchParams(searchParams)
    next.set('q', id)
    setSearchParams(next, { replace: true })
  }

  const updateText = (answer: Answer, text: string) => {
    if (readOnly) return
    const patch: Partial<Pick<Answer, 'text' | 'status'>> = { text }
    if (text.trim().length > 0 && answer.status === 'Belum Dijawab') patch.status = 'Terisi'
    if (text.trim().length === 0 && answer.status === 'Terisi') patch.status = 'Belum Dijawab'
    updateAnswer(answer.id, patch)
  }

  const setStatus = (answer: Answer, status: AnswerStatus) => {
    if (readOnly) return
    updateAnswer(answer.id, { status })
  }

  const changeSessionStatus = async (status: InterviewSession['status']) => {
    await updateSession(session.id, { status })
    notify(`Status sesi diubah menjadi ${status}.`)
  }

  const confirmComplete = async () => {
    setBusy(true)
    try {
      await updateSession(session.id, { status: 'Selesai' })
      notify('Sesi ditandai selesai.')
      setCompleteOpen(false)
    } finally {
      setBusy(false)
    }
  }

  const confirmDelete = async () => {
    setBusy(true)
    try {
      await deleteSession(session.id)
      notify('Sesi beserta jawabannya dihapus.')
      navigate(`/p/${project.id}/sesi`)
    } finally {
      setBusy(false)
    }
  }

  const confirmArchive = async () => {
    setBusy(true)
    try {
      await updateSession(session.id, { status: readOnly ? 'Draft' : 'Diarsipkan' })
      notify(readOnly ? 'Sesi diaktifkan kembali sebagai draft.' : 'Sesi diarsipkan. Jawaban tetap tersimpan.')
      setArchiveOpen(false)
      setDetailOpen(false)
    } finally {
      setBusy(false)
    }
  }

  const refresh = async () => {
    if (readOnly) return
    const count = await refreshSessionQuestions(session.id)
    if (count === 0) {
      notify('Tidak ada pertanyaan aktif baru untuk ditambahkan.', 'info')
      return
    }
    notify(`${count} pertanyaan baru ditambahkan ke sesi ini.`)
  }

  const saveSessionNotes = async () => {
    await updateSession(session.id, { notes: sessionNotesDraft.trim() })
    notify('Catatan sesi disimpan.')
  }

  const answerStatusCounts = ANSWER_STATUSES.map((status) => ({
    status,
    count: questions.filter((question) => answersByQuestion.get(question.id)?.status === status).length,
  }))

  const progressPanel = (
    <div className="space-y-4">
      <section className="rounded-[12px] border border-line bg-surface px-4 py-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-[13px] font-semibold text-ink">Progres sesi</h2>
          <span className="mono-meta text-ink-muted">{progress.percent}%</span>
        </div>
        <Progress
          value={progress.percent}
          className="mt-2"
          label="Progres jawaban sesi"
          tone={progress.percent === 100 ? 'success' : 'primary'}
        />
        <p className="mt-2 text-[11px] text-ink-muted">
          {progress.answered} dari {progress.total} pertanyaan terisi.
        </p>
        <dl className="mt-3 grid grid-cols-2 gap-2 border-t border-line pt-3 text-[11px]">
          {answerStatusCounts.map((item) => (
            <div key={item.status} className="flex items-center justify-between gap-2">
              <dt className="min-w-0 truncate text-ink-muted">{item.status}</dt>
              <dd className="font-medium text-ink">{item.count}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="rounded-[12px] border border-line bg-surface px-4 py-4">
        <h2 className="text-[13px] font-semibold text-ink">Informasi sesi</h2>
        <dl className="mt-2.5 space-y-2 text-[12px]">
          <div>
            <dt className="mono-meta uppercase text-ink-muted">Tanggal</dt>
            <dd className="mt-0.5 text-ink-soft">{formatDateLong(session.interviewDate)}</dd>
          </div>
          <div>
            <dt className="mono-meta uppercase text-ink-muted">Metode</dt>
            <dd className="mt-0.5 text-ink-soft">{session.method}</dd>
          </div>
          <div>
            <dt className="mono-meta uppercase text-ink-muted">Pewawancara</dt>
            <dd className="mt-0.5 text-ink-soft">{session.interviewerName || 'Belum diisi'}</dd>
          </div>
          <div>
            <dt className="mono-meta uppercase text-ink-muted">Durasi</dt>
            <dd className="mt-0.5 text-ink-soft">{session.durationMinutes ? `${session.durationMinutes} menit` : 'Belum diisi'}</dd>
          </div>
          <div>
            <dt className="mono-meta uppercase text-ink-muted">Terakhir diubah</dt>
            <dd className="mt-0.5 text-ink-soft">{relativeTime(session.updatedAt)}</dd>
          </div>
        </dl>
        <div className="mt-3 flex flex-wrap gap-1.5 border-t border-line pt-3">
          <Button size="sm" variant="secondary" icon="edit" onClick={() => setEditOpen(true)} disabled={readOnly}>
            Ubah detail
          </Button>
          <Button size="sm" variant="ghost" icon="note" onClick={() => setDetailOpen(true)}>
            Catatan panjang
          </Button>
        </div>
      </section>

      {respondent ? (
        <section className="rounded-[12px] border border-line bg-surface px-4 py-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-[13px] font-semibold text-ink">Narasumber</h2>
            <Link to={`/p/${project.id}/narasumber/${respondent.id}`} className="inline-flex min-h-7 items-center gap-1 rounded px-1 text-[11px] font-medium text-primary hover:underline">
              Profil
              <Icon name="chevronRight" size={11} />
            </Link>
          </div>
          <div className="mt-2 flex items-start gap-2.5">
            <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-[7px] bg-primary-soft px-1.5 font-mono text-[11px] font-semibold text-primary">
              {respondent.code}
            </span>
            <div className="min-w-0">
              <p className="truncate text-[13px] font-medium text-ink">{respondent.displayName || 'Tanpa nama tampilan'}</p>
              <p className="mt-0.5 line-clamp-3 text-[11px] leading-relaxed text-ink-muted">{respondent.profileNotes || 'Belum ada catatan profil.'}</p>
            </div>
          </div>
        </section>
      ) : null}

      <section className="rounded-[12px] border border-line bg-surface-2/40 px-4 py-3.5">
        <p className="mono-meta uppercase text-ink-muted">Status sesi</p>
        <Select
          value={session.status}
          onChange={(event) => void changeSessionStatus(event.target.value as InterviewSession['status'])}
          aria-label="Status sesi"
          className="mt-2 text-[13px]"
          disabled={readOnly}
        >
          {SESSION_STATUSES.filter((status) => status !== 'Diarsipkan').map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </Select>
        <p className="mt-1.5 text-[11px] leading-relaxed text-ink-muted">
          {session.status === 'Selesai'
            ? 'Sesi selesai. Jawaban masih dapat ditinjau dan diubah bila perlu.'
            : 'Status membantu memfilter sesi dan memantau pekerjaan yang belum selesai.'}
        </p>
      </section>
    </div>
  )

  const questionList = (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-line px-3 py-3">
        <SearchInput value={query} onChange={setQuery} placeholder="Cari pertanyaan…" label="Cari pertanyaan dalam sesi" />
        <div className="mt-2.5 flex items-center justify-between text-[11px]">
          <span className="text-ink-muted">{filteredQuestions.length} pertanyaan</span>
          <span className="mono-meta text-ink-muted">{progress.answered}/{progress.total} terisi</span>
        </div>
        <Progress value={progress.percent} className="mt-2" label="Progres jawaban" tone={progress.percent === 100 ? 'success' : 'primary'} />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {filteredQuestions.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs leading-relaxed text-ink-muted">
            Tidak ada pertanyaan yang cocok dengan pencarian.
          </p>
        ) : (
          <ol className="space-y-0.5">
            {filteredQuestions.map((question) => {
              const index = questions.findIndex((item) => item.id === question.id)
              const answer = answersByQuestion.get(question.id)
              const filled = Boolean(answer && answer.text.trim().length > 0)
              const active = question.id === currentId
              return (
                <li key={question.id}>
                  <button
                    type="button"
                    onClick={() => selectQuestion(question.id)}
                    aria-current={active ? 'true' : undefined}
                    className={cx(
                      'flex w-full items-start gap-2 rounded-[8px] px-2 py-2 text-left transition-colors duration-150',
                      active ? 'bg-primary-soft' : 'hover:bg-surface-2',
                    )}
                  >
                    <span
                      className={cx(
                        'mono-meta mt-0.5 flex h-5 w-6 shrink-0 items-center justify-center rounded text-[10px]',
                        active ? 'bg-surface text-primary' : 'bg-surface-2 text-ink-muted',
                      )}
                    >
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={cx('line-clamp-2 block text-[12px] leading-snug', active ? 'font-medium text-primary' : filled ? 'text-ink-soft' : 'text-ink-muted')}>
                        {question.text}
                      </span>
                      <span className="mt-1 flex items-center gap-1.5">
                        <span
                          className={cx(
                            'h-1.5 w-1.5 rounded-full',
                            !answer || answer.status === 'Belum Dijawab'
                              ? 'bg-line-strong'
                              : answer.status === 'Perlu Klarifikasi'
                                ? 'bg-warn'
                                : answer.status === 'Ditinjau'
                                  ? 'bg-info'
                                  : 'bg-success',
                          )}
                          aria-hidden="true"
                        />
                        <span className="text-[10px] text-ink-muted">{answer?.status ?? 'Belum Dijawab'}</span>
                      </span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ol>
        )}
      </div>
    </div>
  )

  return (
    <>
      <PageHeader
        breadcrumb={
          <>
            <Link to={`/p/${project.id}/sesi`} className="hover:text-ink">
              Sesi wawancara
            </Link>
            <Icon name="chevronRight" size={12} />
            <span className="max-w-[12rem] truncate">{session.title}</span>
          </>
        }
        title={session.title}
        description={
          respondent
            ? `${respondent.code}${respondent.displayName ? ` · ${respondent.displayName}` : ''} · ${formatDate(session.interviewDate)}`
            : `${formatDate(session.interviewDate)} · ${session.method}`
        }
        meta={
          <>
            <StatusBadge status={session.status} />
            <span className="mono-meta">{progress.answered}/{progress.total} terisi</span>
            <span className="text-line-strong">·</span>
            <span className="mono-meta">{progress.percent}%</span>
            <SaveIndicator state={saveState} onRetry={retrySave} className="hidden sm:inline-flex" />
          </>
        }
        actions={
          <>
            <Button variant="secondary" icon="info" onClick={() => setDetailOpen(true)} className="max-lg:hidden">
              Detail sesi
            </Button>
            <Button
              variant={session.status === 'Selesai' ? 'secondary' : 'primary'}
              icon={session.status === 'Selesai' ? 'refresh' : 'checkCircle'}
              onClick={() => {
                if (session.status === 'Selesai') {
                  void changeSessionStatus('Perlu Ditinjau')
                  return
                }
                if (progress.answered < progress.total) {
                  setCompleteOpen(true)
                } else {
                  setCompleteOpen(true)
                }
              }}
              disabled={readOnly}
            >
              {session.status === 'Selesai' ? 'Buka kembali' : 'Tandai selesai'}
            </Button>
          </>
        }
      />

      {readOnly ? (
        <InlineNotice
          tone="warn"
          className="mb-4"
          title="Sesi diarsipkan"
          action={
            <Button size="sm" variant="secondary" icon="archive" onClick={() => setArchiveOpen(true)}>
              Aktifkan sesi
            </Button>
          }
        >
          Jawaban tidak dapat diubah selama sesi diarsipkan. Aktifkan kembali sebagai draft bila perlu meninjau atau
          melengkapi jawaban.
        </InlineNotice>
      ) : null}

      {newQuestionCount > 0 && !readOnly ? (
        <InlineNotice
          tone="info"
          className="mb-4"
          title={`${newQuestionCount} pertanyaan aktif baru belum ada di sesi ini`}
          action={
            <Button size="sm" variant="secondary" icon="refresh" onClick={() => void refresh()} disabled={busy}>
              Tambahkan
            </Button>
          }
        >
          Pertanyaan yang ditambahkan ke panduan setelah sesi ini dibuat tidak otomatis masuk. Tambahkan agar ikut dijawab
          pada sesi ini.
        </InlineNotice>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)_300px] xl:items-start">
        <aside className="hidden min-h-0 rounded-[12px] border border-line bg-surface lg:sticky lg:top-20 lg:block lg:h-[calc(100dvh-7rem)]">
          {questionList}
        </aside>

        <section className="min-w-0">
          <div className="mb-3 flex items-center justify-between gap-2 lg:hidden">
            <Button variant="secondary" size="sm" icon="menu" onClick={() => setListOpen(true)}>
              Daftar pertanyaan
            </Button>
            <span className="mono-meta text-ink-muted">
              {currentIndex + 1} / {questions.length}
            </span>
          </div>

          {questions.length === 0 ? (
            <EmptyState
              icon="guide"
              title="Sesi ini belum memiliki pertanyaan"
              description="Tambahkan pertanyaan ke panduan, lalu segarkan daftar pertanyaan pada sesi ini."
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  <Link to={`/p/${project.id}/panduan`}>
                    <Button variant="secondary" icon="guide">
                      Buka panduan
                    </Button>
                  </Link>
                  <Button variant="primary" icon="refresh" onClick={() => void refresh()} disabled={readOnly}>
                    Segarkan pertanyaan
                  </Button>
                </div>
              }
            />
          ) : !current ? (
            <EmptyState
              icon="search"
              title="Pilih pertanyaan"
              description="Pilih salah satu pertanyaan pada daftar untuk mulai mencatat jawaban."
              action={
                <Button variant="secondary" onClick={() => setListOpen(true)}>
                  Buka daftar pertanyaan
                </Button>
              }
            />
          ) : (
            <article className="overflow-hidden rounded-[12px] border border-line bg-surface">
              <div className="flex flex-wrap items-center gap-2 border-b border-line bg-surface-2/40 px-4 py-2.5 sm:px-5">
                <span className="mono-meta rounded bg-surface px-1.5 py-0.5 text-[10px] text-ink-muted">
                  Pertanyaan {String(currentIndex + 1).padStart(2, '0')} / {String(questions.length).padStart(2, '0')}
                </span>
                {currentSection ? <Badge tone="neutral">{currentSection.title}</Badge> : <Badge tone="neutral">Tanpa bagian</Badge>}
                {current.isRequired ? <Badge tone="accent">Wajib</Badge> : null}
                {currentAnswer ? <StatusBadge status={currentAnswer.status} className="ml-auto" /> : null}
              </div>

              <div className="px-4 py-5 sm:px-6 sm:py-6">
                <h2 className="text-[18px] font-semibold leading-snug tracking-[-0.01em] text-ink sm:text-[21px]">{current.text}</h2>
                {current.guidance ? (
                  <div className="mt-3 flex gap-2 rounded-[9px] border border-line bg-surface-2/50 px-3 py-2.5">
                    <Icon name="info" size={15} className="mt-0.5 shrink-0 text-info" />
                    <div className="min-w-0">
                      <p className="mono-meta uppercase text-ink-muted">Panduan pewawancara</p>
                      <p className="mt-1 whitespace-pre-line text-[13px] leading-relaxed text-ink-soft">{current.guidance}</p>
                    </div>
                  </div>
                ) : null}

                {currentAnswer ? (
                  <div className="mt-5 space-y-4">
                    <Field
                      label="Jawaban narasumber"
                      htmlFor="answer-text"
                      required={current.isRequired}
                      hint="Tulis ringkasan atau kutipan langsung. Perubahan tersimpan otomatis."
                    >
                      <Textarea
                        id="answer-text"
                        value={currentAnswer.text}
                        onChange={(event) => updateText(currentAnswer, event.target.value)}
                        className="min-h-[190px] text-[15px] leading-relaxed"
                        placeholder="Tulis jawaban narasumber di sini…"
                        disabled={readOnly}
                      />
                    </Field>

                    <Field
                      label="Catatan pewawancara"
                      htmlFor="answer-notes"
                      optional
                      hint="Kesan, konteks, atau hal yang perlu diklarifikasi. Tidak dihitung sebagai jawaban."
                    >
                      <Textarea
                        id="answer-notes"
                        value={currentAnswer.interviewerNotes}
                        onChange={(event) => updateAnswer(currentAnswer.id, { interviewerNotes: event.target.value })}
                        className="min-h-20 text-[14px]"
                        placeholder="Contoh: Narasumber ragu saat menyebut durasi belajar."
                        disabled={readOnly}
                      />
                    </Field>

                    <div className="flex flex-col gap-3 rounded-[10px] border border-line bg-surface-2/40 px-3.5 py-3 sm:flex-row sm:items-end sm:justify-between">
                      <div className="w-full sm:max-w-xs">
                        <Field label="Status jawaban" htmlFor="answer-status" hint="Gunakan Perlu Klarifikasi bila jawaban belum lengkap.">
                          <Select
                            id="answer-status"
                            value={currentAnswer.status}
                            onChange={(event) => setStatus(currentAnswer, event.target.value as AnswerStatus)}
                            disabled={readOnly}
                          >
                            {ANSWER_STATUSES.map((status) => (
                              <option key={status} value={status}>
                                {status}
                              </option>
                            ))}
                          </Select>
                        </Field>
                      </div>
                      <div className="flex items-center justify-between gap-2 sm:justify-end">
                        <SaveIndicator state={saveState} onRetry={retrySave} />
                      </div>
                    </div>
                  </div>
                ) : (
                  <InlineNotice tone="warn" className="mt-5" title="Slot jawaban belum tersedia">
                    Pertanyaan ini ada di sesi tetapi belum memiliki slot jawaban. Segarkan daftar pertanyaan untuk
                    membuat slot baru.
                  </InlineNotice>
                )}
              </div>

              <div className="flex items-center justify-between gap-2 border-t border-line px-4 py-3 sm:px-5">
                <Button
                  variant="secondary"
                  icon="arrowLeft"
                  onClick={() => selectQuestion(questions[Math.max(0, currentIndex - 1)].id)}
                  disabled={currentIndex <= 0}
                >
                  Sebelumnya
                </Button>
                <span className="mono-meta hidden text-ink-muted sm:block">
                  {progress.answered}/{progress.total} terisi
                </span>
                {currentIndex < questions.length - 1 ? (
                  <Button variant="primary" iconRight="arrowRight" onClick={() => selectQuestion(questions[currentIndex + 1].id)}>
                    Berikutnya
                  </Button>
                ) : (
                  <Button variant="primary" icon="checkCircle" onClick={() => setCompleteOpen(true)} disabled={readOnly}>
                    Tandai selesai
                  </Button>
                )}
              </div>
            </article>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-ink-muted">
            <span className="inline-flex items-center gap-1.5">
              <Icon name="save" size={12} />
              Jawaban disimpan otomatis di perangkat ini
            </span>
            <button type="button" onClick={() => setDetailOpen(true)} className="inline-flex min-h-7 items-center gap-1 rounded px-1 text-primary hover:underline lg:hidden">
              Detail dan catatan sesi
            </button>
          </div>
        </section>

        <aside className="hidden xl:sticky xl:top-20 xl:block">{progressPanel}</aside>
      </div>

      <Drawer open={listOpen} onClose={() => setListOpen(false)} title="Daftar pertanyaan" description={`${progress.answered} dari ${progress.total} terisi`}>
        <div className="-mx-5 -my-5 h-[calc(100dvh-9rem)]">{questionList}</div>
      </Drawer>

      <Drawer
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        title="Detail sesi"
        description={session.title}
        width="lg"
        footer={
          <>
            <Button variant="secondary" icon="trash" onClick={() => { setDetailOpen(false); setDeleteOpen(true) }}>
              Hapus
            </Button>
            <Button variant="secondary" icon="archive" onClick={() => setArchiveOpen(true)} disabled={busy}>
              {readOnly ? 'Aktifkan' : 'Arsipkan'}
            </Button>
            <Button variant="primary" icon="edit" onClick={() => setEditOpen(true)} disabled={readOnly}>
              Ubah detail
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={session.status} />
            <Badge tone="neutral">{session.method}</Badge>
            <span className="mono-meta text-ink-muted">Dibuat {formatDate(session.createdAt)}</span>
          </div>

          <dl className="grid grid-cols-2 gap-3 text-[12px]">
            <div>
              <dt className="mono-meta uppercase text-ink-muted">Narasumber</dt>
              <dd className="mt-0.5 text-ink-soft">{respondent ? `${respondent.code}${respondent.displayName ? ` · ${respondent.displayName}` : ''}` : 'Tidak ditemukan'}</dd>
            </div>
            <div>
              <dt className="mono-meta uppercase text-ink-muted">Tanggal</dt>
              <dd className="mt-0.5 text-ink-soft">{formatDateLong(session.interviewDate)}</dd>
            </div>
            <div>
              <dt className="mono-meta uppercase text-ink-muted">Pewawancara</dt>
              <dd className="mt-0.5 text-ink-soft">{session.interviewerName || 'Belum diisi'}</dd>
            </div>
            <div>
              <dt className="mono-meta uppercase text-ink-muted">Durasi</dt>
              <dd className="mt-0.5 text-ink-soft">{session.durationMinutes ? `${session.durationMinutes} menit` : 'Belum diisi'}</dd>
            </div>
          </dl>

          <div>
            <div className="flex items-center justify-between gap-2">
              <p className="text-[13px] font-medium text-ink">Progres</p>
              <span className="mono-meta text-ink-muted">{progress.answered}/{progress.total}</span>
            </div>
            <Progress value={progress.percent} className="mt-2" label="Progres jawaban sesi" tone={progress.percent === 100 ? 'success' : 'primary'} />
          </div>

          <div>
            <Field
              label="Catatan sesi"
              htmlFor="session-notes"
              optional
              hint="Konteks umum sesi. Catatan per pertanyaan diisi pada kolom catatan pewawancara."
            >
              <Textarea
                id="session-notes"
                value={sessionNotesDraft}
                onChange={(event) => setSessionNotesDraft(event.target.value)}
                className="min-h-32"
                maxLength={2000}
                disabled={readOnly}
              />
            </Field>
            <div className="mt-2 flex justify-end">
              <Button size="sm" variant="secondary" icon="save" onClick={() => void saveSessionNotes()} disabled={readOnly || sessionNotesDraft.trim() === session.notes.trim()}>
                Simpan catatan
              </Button>
            </div>
          </div>

          {session.status === 'Selesai' ? (
            <InlineNotice tone="success" title="Sesi selesai">
              Jawaban masih dapat ditinjau. Buka kembali sesi bila ada perubahan yang perlu dicatat.
            </InlineNotice>
          ) : null}
        </div>
      </Drawer>

      <SessionDialog open={editOpen} onClose={() => setEditOpen(false)} projectId={project.id} session={session} />

      <ConfirmDialog
        open={completeOpen}
        onClose={() => setCompleteOpen(false)}
        onConfirm={() => void confirmComplete()}
        busy={busy}
        tone="primary"
        title={session.status === 'Selesai' ? 'Sesi sudah selesai' : 'Tandai sesi selesai?'}
        description={
          progress.answered < progress.total
            ? `Masih ada ${progress.total - progress.answered} pertanyaan yang belum terisi.`
            : 'Semua pertanyaan yang tercatat pada sesi ini sudah terisi.'
        }
        impact={
          session.status === 'Selesai'
            ? 'Sesi ini sudah ditandai selesai. Anda dapat membukanya kembali bila perlu meninjau jawaban.'
            : 'Status sesi berubah menjadi Selesai. Jawaban tetap dapat diubah dan status dapat dibuka kembali kapan saja.'
        }
        confirmLabel={session.status === 'Selesai' ? 'Tutup' : 'Tandai selesai'}
      />

      <ConfirmDialog
        open={archiveOpen}
        onClose={() => setArchiveOpen(false)}
        onConfirm={() => void confirmArchive()}
        busy={busy}
        tone="primary"
        title={readOnly ? 'Aktifkan sesi?' : 'Arsipkan sesi?'}
        description={readOnly ? 'Sesi akan diaktifkan kembali sebagai draft.' : 'Sesi akan disembunyikan dari daftar aktif.'}
        impact={
          readOnly
            ? 'Jawaban dapat diubah kembali setelah sesi aktif.'
            : 'Jawaban, coding, dan bukti tema tetap tersimpan. Sesi dapat ditampilkan lagi dengan filter arsip.'
        }
        confirmLabel={readOnly ? 'Aktifkan' : 'Arsipkan'}
      />

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => void confirmDelete()}
        busy={busy}
        title={`Hapus sesi “${session.title}”?`}
        description="Tindakan ini tidak dapat dibatalkan."
        impact={`${progress.answered} jawaban terisi akan dihapus, termasuk coding dan bukti tema yang merujuk jawaban tersebut. Narasumber dan panduan tetap tersimpan.`}
        confirmLabel="Hapus sesi"
      />
    </>
  )
}
