import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { usePageTitle, useProject } from '../lib/hooks'
import { useWorkspace } from '../lib/store'
import type { Question, Section } from '../lib/types'
import { documentFromExtraction } from '../lib/import'
import type { ExtractionResult } from '../lib/import'
import { projectQuestions, projectSections, questionAnswerCount } from '../lib/selectors'
import { truncate } from '../lib/utils'
import { ImportReviewDialog, ImportSourceDialog } from '../components/ImportDialog'
import { Icon } from '../components/Icon'
import {
  Badge,
  Button,
  Checkbox,
  ConfirmDialog,
  EmptyState,
  Field,
  IconButton,
  InlineNotice,
  Input,
  Modal,
  PageHeader,
  SearchInput,
  Select,
  Textarea,
  cx,
  useToast,
} from '../components/ui'

interface QuestionDraft {
  mode: 'create' | 'edit'
  question?: Question
}

interface SectionDraft {
  mode: 'create' | 'edit'
  section?: Section
}

interface PendingReview {
  text: string
  fileName: string
  sourceDocumentId: string
}

const MAX_QUESTION = 500
const MAX_GUIDANCE = 1200

export function Guide() {
  const project = useProject()
  const {
    data,
    addDocument,
    deleteSection,
    reorderSections,
    createQuestion,
    updateQuestion,
    deleteQuestion,
    reorderQuestions,
  } = useWorkspace()
  const { notify } = useToast()
  const [searchParams, setSearchParams] = useSearchParams()
  usePageTitle('Panduan wawancara')

  const [query, setQuery] = useState('')
  const [sectionFilter, setSectionFilter] = useState('semua')
  const [activeFilter, setActiveFilter] = useState('semua')
  const [questionDraft, setQuestionDraft] = useState<QuestionDraft | null>(null)
  const [sectionDraft, setSectionDraft] = useState<SectionDraft | null>(null)
  const [deletingSection, setDeletingSection] = useState<Section | null>(null)
  const [deletingQuestion, setDeletingQuestion] = useState<Question | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [review, setReview] = useState<PendingReview | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const sections = project ? projectSections(data, project.id) : []
  const questions = project ? projectQuestions(data, project.id, true) : []

  useEffect(() => {
    if (searchParams.get('tambah') === '1') {
      setQuestionDraft({ mode: 'create' })
      const next = new URLSearchParams(searchParams)
      next.delete('tambah')
      setSearchParams(next, { replace: true })
    }
  }, [searchParams, setSearchParams])

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return questions.filter((question) => {
      if (sectionFilter === 'tanpa' && question.sectionId) return false
      if (sectionFilter !== 'semua' && sectionFilter !== 'tanpa' && question.sectionId !== sectionFilter) return false
      if (activeFilter === 'aktif' && !question.isActive) return false
      if (activeFilter === 'nonaktif' && question.isActive) return false
      if (!needle) return true
      return question.text.toLowerCase().includes(needle) || question.guidance.toLowerCase().includes(needle)
    })
  }, [questions, query, sectionFilter, activeFilter])

  const hasFilter = query.trim() !== '' || sectionFilter !== 'semua' || activeFilter !== 'semua'
  const activeCount = questions.filter((question) => question.isActive).length
  const inactiveCount = questions.length - activeCount

  if (!project) return null

  const sectionTitle = (id: string | null) => {
    if (!id) return 'Tanpa bagian'
    return sections.find((section) => section.id === id)?.title ?? 'Bagian tidak ditemukan'
  }

  const answersFor = (questionId: string) => questionAnswerCount(data, questionId)
  const sessionsUsing = (questionId: string) =>
    data.sessions.filter((session) => session.projectId === project.id && session.questionIds.includes(questionId)).length

  const moveQuestion = async (question: Question, direction: -1 | 1) => {
    const ids = questions.map((item) => item.id)
    const index = ids.indexOf(question.id)
    const target = index + direction
    if (index === -1 || target < 0 || target >= ids.length) return
    const next = [...ids]
    const [row] = next.splice(index, 1)
    next.splice(target, 0, row)
    await reorderQuestions(project.id, next)
  }

  const handleDrop = async (targetId: string) => {
    if (!dragId || dragId === targetId) {
      setDragId(null)
      setOverId(null)
      return
    }
    const ids = questions.map((item) => item.id)
    const from = ids.indexOf(dragId)
    const to = ids.indexOf(targetId)
    if (from === -1 || to === -1) return
    const next = [...ids]
    const [row] = next.splice(from, 1)
    const insertAt = next.indexOf(targetId)
    next.splice(insertAt < 0 ? to : insertAt, 0, row)
    setDragId(null)
    setOverId(null)
    await reorderQuestions(project.id, next)
    notify('Urutan pertanyaan diperbarui.')
  }

  const duplicateQuestion = async (question: Question) => {
    const created = await createQuestion({
      projectId: project.id,
      sectionId: question.sectionId,
      text: `${question.text} (salinan)`,
      guidance: question.guidance,
      orderIndex: questions.length,
      isRequired: question.isRequired,
      isActive: true,
      sourceDocumentId: question.sourceDocumentId,
    })
    if (!created) {
      notify('Pertanyaan tidak dapat diduplikasi.', 'error')
      return
    }
    const ids = questions.map((item) => item.id)
    const index = ids.indexOf(question.id)
    ids.splice(index + 1, 0, created.id)
    await reorderQuestions(project.id, ids)
    notify('Pertanyaan diduplikasi. Ubah teks salinan agar tidak sama dengan aslinya.')
    setQuestionDraft({ mode: 'edit', question: created })
  }

  const handleExtracted = async (result: ExtractionResult) => {
    const doc = documentFromExtraction(project.id, result)
    await addDocument(doc)
    setReview({ text: result.text, fileName: result.fileName, sourceDocumentId: doc.id })
    notify('Dokumen tersimpan. Tinjau pertanyaan sebelum menambahkannya.')
  }

  const toggleActive = async (question: Question) => {
    await updateQuestion(question.id, { isActive: !question.isActive })
    notify(question.isActive ? 'Pertanyaan dinonaktifkan. Jawaban lama tetap tersimpan.' : 'Pertanyaan diaktifkan kembali.')
  }

  const confirmDeleteQuestion = async () => {
    if (!deletingQuestion) return
    setBusy(true)
    try {
      await deleteQuestion(deletingQuestion.id)
      notify('Pertanyaan dan jawaban terkait dihapus permanen.')
      setDeletingQuestion(null)
    } finally {
      setBusy(false)
    }
  }

  const confirmDeleteSection = async () => {
    if (!deletingSection) return
    setBusy(true)
    try {
      await deleteSection(deletingSection.id)
      notify('Bagian dihapus. Pertanyaannya dipindahkan ke Tanpa bagian.')
      setDeletingSection(null)
    } finally {
      setBusy(false)
    }
  }

  const moveSection = async (section: Section, direction: -1 | 1) => {
    const ids = sections.map((item) => item.id)
    const index = ids.indexOf(section.id)
    const target = index + direction
    if (index === -1 || target < 0 || target >= ids.length) return
    const next = [...ids]
    const [row] = next.splice(index, 1)
    next.splice(target, 0, row)
    await reorderSections(project.id, next)
  }

  return (
    <>
      <PageHeader
        title="Panduan wawancara"
        description="Susun pertanyaan dalam urutan yang akan dipakai saat sesi. Perubahan urutan langsung berlaku untuk sesi baru."
        meta={
          <>
            <Badge tone="primary">{activeCount} aktif</Badge>
            {inactiveCount > 0 ? <Badge tone="neutral">{inactiveCount} nonaktif</Badge> : null}
            <span className="text-ink-muted">{sections.length} bagian</span>
          </>
        }
        actions={
          <>
            <Button variant="secondary" icon="upload" onClick={() => setImportOpen(true)}>
              Impor dokumen
            </Button>
            <Button variant="primary" icon="plus" onClick={() => setQuestionDraft({ mode: 'create' })}>
              Tambah pertanyaan
            </Button>
          </>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[240px_minmax(0,1fr)] lg:items-start">
        <aside className="min-w-0">
          <section className="rounded-[12px] border border-line bg-surface">
            <div className="flex items-center justify-between gap-2 border-b border-line px-3.5 py-3">
              <h2 className="text-[13px] font-semibold text-ink">Bagian</h2>
              <IconButton label="Tambah bagian" icon="plus" size="sm" onClick={() => setSectionDraft({ mode: 'create' })} />
            </div>
            <div className="p-2">
              <button
                type="button"
                onClick={() => setSectionFilter('semua')}
                className={cx(
                  'flex min-h-9 w-full items-center justify-between gap-2 rounded-md px-2 text-left text-[13px] transition-colors',
                  sectionFilter === 'semua' ? 'bg-primary-soft text-primary' : 'text-ink-soft hover:bg-surface-2 hover:text-ink',
                )}
              >
                <span>Semua pertanyaan</span>
                <span className="mono-meta text-[10px]">{questions.length}</span>
              </button>
              <button
                type="button"
                onClick={() => setSectionFilter('tanpa')}
                className={cx(
                  'flex min-h-9 w-full items-center justify-between gap-2 rounded-md px-2 text-left text-[13px] transition-colors',
                  sectionFilter === 'tanpa' ? 'bg-primary-soft text-primary' : 'text-ink-soft hover:bg-surface-2 hover:text-ink',
                )}
              >
                <span>Tanpa bagian</span>
                <span className="mono-meta text-[10px]">{questions.filter((question) => !question.sectionId).length}</span>
              </button>

              {sections.length > 0 ? (
                <ul className="mt-1 space-y-0.5 border-t border-line pt-1">
                  {sections.map((section, index) => {
                    const count = questions.filter((question) => question.sectionId === section.id).length
                    const active = sectionFilter === section.id
                    return (
                      <li key={section.id} className="group">
                        <div
                          className={cx(
                            'flex items-center gap-0.5 rounded-md pr-0.5 transition-colors',
                            active ? 'bg-primary-soft' : 'hover:bg-surface-2',
                          )}
                        >
                          <button
                            type="button"
                            onClick={() => setSectionFilter(section.id)}
                            className={cx(
                              'flex min-h-9 min-w-0 flex-1 items-center justify-between gap-2 rounded-md px-2 text-left text-[13px]',
                              active ? 'text-primary' : 'text-ink-soft',
                            )}
                          >
                            <span className="min-w-0 truncate">{section.title}</span>
                            <span className="mono-meta shrink-0 text-[10px]">{count}</span>
                          </button>
                          <div className="flex shrink-0 items-center opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 max-sm:opacity-100">
                            <IconButton label="Naikkan bagian" icon="chevronRight" size="sm" className="-rotate-90 scale-75" onClick={() => void moveSection(section, -1)} disabled={index === 0} />
                            <IconButton label="Turunkan bagian" icon="chevronRight" size="sm" className="rotate-90 scale-75" onClick={() => void moveSection(section, 1)} disabled={index === sections.length - 1} />
                            <IconButton label="Ubah bagian" icon="edit" size="sm" className="scale-75" onClick={() => setSectionDraft({ mode: 'edit', section })} />
                            <IconButton label="Hapus bagian" icon="trash" size="sm" danger className="scale-75" onClick={() => setDeletingSection(section)} />
                          </div>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <p className="px-2 pt-2 text-[11px] leading-relaxed text-ink-muted">
                  Belum ada bagian. Bagian membantu mengelompokkan pertanyaan, misalnya Latar belakang atau Tantangan.
                </p>
              )}
            </div>
          </section>

          <section className="mt-3 rounded-[12px] border border-line bg-surface-2/40 px-3.5 py-3">
            <p className="mono-meta uppercase text-ink-muted">Tips urutan</p>
            <p className="mt-1 text-[11px] leading-relaxed text-ink-muted">
              Tarik pegangan di kiri pertanyaan untuk memindahkan urutan. Tombol panah tersedia untuk pengguna keyboard
              dan layar sentuh.
            </p>
          </section>
        </aside>

        <div className="min-w-0">
          <section className="rounded-[12px] border border-line bg-surface">
            <div className="flex flex-col gap-3 border-b border-line px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <div>
                <h2 className="text-[15px] font-semibold text-ink">
                  {sectionFilter === 'semua'
                    ? 'Semua pertanyaan'
                    : sectionFilter === 'tanpa'
                      ? 'Tanpa bagian'
                      : sectionTitle(sectionFilter)}
                </h2>
                <p className="mt-0.5 text-xs text-ink-muted">
                  {filtered.length} pertanyaan ditampilkan{hasFilter ? ' sesuai filter' : ''}.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <SearchInput value={query} onChange={setQuery} placeholder="Cari pertanyaan…" className="min-w-0 flex-1 sm:w-52" />
                <Select value={activeFilter} onChange={(event) => setActiveFilter(event.target.value)} aria-label="Filter status pertanyaan" className="text-[13px] sm:w-36">
                  <option value="semua">Semua status</option>
                  <option value="aktif">Aktif</option>
                  <option value="nonaktif">Nonaktif</option>
                </Select>
              </div>
            </div>

            {questions.length === 0 ? (
              <div className="p-4 sm:p-5">
                <EmptyState
                  icon="guide"
                  title="Panduan masih kosong"
                  description="Impor dokumen panduan atau tulis pertanyaan pertama. Anda dapat mengubah urutan, menambahkan bagian, dan menandai pertanyaan wajib."
                  action={
                    <div className="flex flex-wrap justify-center gap-2">
                      <Button variant="primary" icon="plus" onClick={() => setQuestionDraft({ mode: 'create' })}>
                        Tulis pertanyaan
                      </Button>
                      <Button variant="secondary" icon="upload" onClick={() => setImportOpen(true)}>
                        Impor dokumen
                      </Button>
                    </div>
                  }
                />
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-4 sm:p-5">
                <EmptyState
                  icon="search"
                  title="Tidak ada pertanyaan yang cocok"
                  description="Ubah kata kunci atau filter untuk menemukan pertanyaan lain."
                  action={
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setQuery('')
                        setSectionFilter('semua')
                        setActiveFilter('semua')
                      }}
                    >
                      Reset filter
                    </Button>
                  }
                />
              </div>
            ) : (
              <ol className="divide-y divide-line">
                {filtered.map((question) => {
                  const index = questions.findIndex((item) => item.id === question.id)
                  const answers = answersFor(question.id)
                  const usedIn = sessionsUsing(question.id)
                  return (
                    <li
                      key={question.id}
                      draggable
                      onDragStart={(event) => {
                        setDragId(question.id)
                        event.dataTransfer.effectAllowed = 'move'
                        event.dataTransfer.setData('text/plain', question.id)
                      }}
                      onDragEnd={() => {
                        setDragId(null)
                        setOverId(null)
                      }}
                      onDragOver={(event) => {
                        event.preventDefault()
                        if (overId !== question.id) setOverId(question.id)
                      }}
                      onDragLeave={() => setOverId((current) => (current === question.id ? null : current))}
                      onDrop={(event) => {
                        event.preventDefault()
                        void handleDrop(question.id)
                      }}
                      className={cx(
                        'group flex items-start gap-2 px-3 py-3.5 transition-colors sm:gap-3 sm:px-5',
                        dragId === question.id ? 'opacity-50' : '',
                        overId === question.id && dragId && dragId !== question.id ? 'bg-primary-soft/50' : 'hover:bg-surface-2/30',
                        !question.isActive ? 'bg-surface-2/30' : '',
                      )}
                    >
                      <button
                        type="button"
                        aria-label={`Tarik untuk memindahkan pertanyaan ${index + 1}`}
                        className="mt-1 hidden h-8 w-5 shrink-0 cursor-grab items-center justify-center rounded text-ink-muted hover:bg-surface-2 hover:text-ink active:cursor-grabbing sm:flex"
                        tabIndex={-1}
                      >
                        <Icon name="grip" size={15} />
                      </button>
                      <span className="mono-meta mt-1.5 w-6 shrink-0 text-ink-muted">{String(index + 1).padStart(2, '0')}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="mono-meta rounded bg-surface-2 px-1.5 py-0.5 text-[10px] text-ink-muted">{sectionTitle(question.sectionId)}</span>
                          {question.isRequired ? <Badge tone="accent">Wajib</Badge> : null}
                          {!question.isActive ? <Badge tone="neutral">Nonaktif</Badge> : null}
                          {question.sourceDocumentId ? <Badge tone="info">Dari dokumen</Badge> : null}
                        </div>
                        <p className={cx('mt-1.5 text-[14px] font-medium leading-relaxed', question.isActive ? 'text-ink' : 'text-ink-muted')}>
                          {question.text}
                        </p>
                        {question.guidance ? (
                          <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-ink-muted">{truncate(question.guidance, 200)}</p>
                        ) : null}
                        <p className="mt-1.5 text-[11px] text-ink-muted">
                          {answers > 0 ? `${answers} jawaban` : 'Belum dijawab'} · {usedIn} sesi
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-center gap-0.5 sm:flex-row">
                        <div className="flex items-center">
                          <IconButton label="Naikkan pertanyaan" icon="chevronRight" size="sm" className="-rotate-90" onClick={() => void moveQuestion(question, -1)} disabled={index === 0} />
                          <IconButton
                            label="Turunkan pertanyaan"
                            icon="chevronRight"
                            size="sm"
                            className="rotate-90"
                            onClick={() => void moveQuestion(question, 1)}
                            disabled={index === questions.length - 1}
                          />
                        </div>
                        <div className="flex items-center">
                          <IconButton label="Ubah pertanyaan" icon="edit" size="sm" onClick={() => setQuestionDraft({ mode: 'edit', question })} />
                          <IconButton label="Duplikasi pertanyaan" icon="copy" size="sm" onClick={() => void duplicateQuestion(question)} />
                          <IconButton
                            label={question.isActive ? 'Nonaktifkan pertanyaan' : 'Aktifkan pertanyaan'}
                            icon="archive"
                            size="sm"
                            onClick={() => void toggleActive(question)}
                          />
                          <IconButton label="Hapus pertanyaan" icon="trash" size="sm" danger onClick={() => setDeletingQuestion(question)} />
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ol>
            )}
          </section>

          <p className="mt-3 text-xs leading-relaxed text-ink-muted">
            Pertanyaan nonaktif tidak ditambahkan ke sesi baru, tetapi tetap tersimpan bersama jawaban lama. Sesi yang sudah
            berjalan dapat menyegarkan daftar pertanyaan dari ruang sesi.
          </p>
        </div>
      </div>

      <QuestionEditor
        draft={questionDraft}
        sections={sections}
        projectId={project.id}
        maxOrder={questions.length}
        onClose={() => setQuestionDraft(null)}
      />

      <SectionEditor draft={sectionDraft} projectId={project.id} onClose={() => setSectionDraft(null)} />

      <ImportSourceDialog open={importOpen} onClose={() => setImportOpen(false)} onExtracted={(result) => void handleExtracted(result)} />

      {review ? (
        <ImportReviewDialog
          open={Boolean(review)}
          onClose={() => setReview(null)}
          project={project}
          text={review.text}
          fileName={review.fileName}
          sourceDocumentId={review.sourceDocumentId}
          onManual={() => {
            setReview(null)
            setQuestionDraft({ mode: 'create' })
          }}
        />
      ) : null}

      <DeleteQuestionDialog
        question={deletingQuestion}
        answers={deletingQuestion ? answersFor(deletingQuestion.id) : 0}
        busy={busy}
        onClose={() => setDeletingQuestion(null)}
        onArchive={async () => {
          if (!deletingQuestion) return
          setBusy(true)
          try {
            await updateQuestion(deletingQuestion.id, { isActive: false })
            notify('Pertanyaan dinonaktifkan. Jawaban lama tetap tersimpan.')
            setDeletingQuestion(null)
          } finally {
            setBusy(false)
          }
        }}
        onDelete={() => void confirmDeleteQuestion()}
      />

      <ConfirmDialog
        open={Boolean(deletingSection)}
        onClose={() => setDeletingSection(null)}
        onConfirm={() => void confirmDeleteSection()}
        busy={busy}
        title={deletingSection ? `Hapus bagian “${deletingSection.title}”?` : 'Hapus bagian?'}
        description="Bagian akan dihapus dari panduan."
        impact={`${
          deletingSection ? questions.filter((question) => question.sectionId === deletingSection.id).length : 0
        } pertanyaan di dalamnya tidak dihapus, tetapi dipindahkan ke Tanpa bagian.`}
        confirmLabel="Hapus bagian"
      />
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Editor pertanyaan                                                   */
/* ------------------------------------------------------------------ */

function QuestionEditor({
  draft,
  sections,
  projectId,
  maxOrder,
  onClose,
}: {
  draft: QuestionDraft | null
  sections: Section[]
  projectId: string
  maxOrder: number
  onClose: () => void
}) {
  const { data, createQuestion, updateQuestion } = useWorkspace()
  const { notify } = useToast()
  const [text, setText] = useState('')
  const [guidance, setGuidance] = useState('')
  const [sectionId, setSectionId] = useState('')
  const [required, setRequired] = useState(true)
  const [acknowledged, setAcknowledged] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const editing = draft?.question
  const answers = editing ? data.answers.filter((answer) => answer.questionId === editing.id && answer.text.trim().length > 0).length : 0

  useEffect(() => {
    if (!draft) return
    setText(draft.question?.text ?? '')
    setGuidance(draft.question?.guidance ?? '')
    setSectionId(draft.question?.sectionId ?? '')
    setRequired(draft.question?.isRequired ?? true)
    setAcknowledged(false)
    setError(null)
    setBusy(false)
  }, [draft])

  const save = async () => {
    const value = text.trim()
    if (value.length < 6) {
      setError('Tulis pertanyaan minimal 6 karakter agar jelas saat wawancara.')
      return
    }
    if (value.length > MAX_QUESTION) {
      setError(`Pertanyaan maksimal ${MAX_QUESTION} karakter.`)
      return
    }
    if (answers > 0 && !acknowledged) {
      setError('Centang konfirmasi sebelum menyimpan perubahan pada pertanyaan yang sudah dijawab.')
      return
    }
    setBusy(true)
    try {
      if (editing) {
        await updateQuestion(editing.id, {
          text: value,
          guidance: guidance.trim(),
          sectionId: sectionId || null,
          isRequired: required,
        })
        notify('Pertanyaan diperbarui.')
      } else {
        const created = await createQuestion({
          projectId,
          sectionId: sectionId || null,
          text: value,
          guidance: guidance.trim(),
          orderIndex: maxOrder,
          isRequired: required,
          isActive: true,
          sourceDocumentId: null,
        })
        if (!created) {
          setError('Pertanyaan tidak dapat disimpan. Coba lagi.')
          return
        }
        notify('Pertanyaan ditambahkan ke panduan.')
      }
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={Boolean(draft)}
      onClose={onClose}
      title={editing ? 'Ubah pertanyaan' : 'Tambah pertanyaan'}
      description={editing ? 'Perubahan berlaku pada tampilan panduan dan sesi baru.' : 'Pertanyaan akan ditambahkan di akhir urutan panduan.'}
      size="lg"
      preventClose={busy}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Batal
          </Button>
          <Button variant="primary" onClick={() => void save()} disabled={busy || text.trim().length < 6}>
            {busy ? 'Menyimpan…' : editing ? 'Simpan perubahan' : 'Tambah pertanyaan'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {answers > 0 ? (
          <InlineNotice tone="warn" title={`Pertanyaan ini sudah memiliki ${answers} jawaban`}>
            Mengubah teks pertanyaan tidak mengubah teks jawaban yang tersimpan. Jawaban lama akan tetap terhubung ke
            pertanyaan ini, dan kutipan coding yang tidak lagi cocok akan ditandai pada pemeriksaan data.
          </InlineNotice>
        ) : null}

        <Field label="Teks pertanyaan" htmlFor="question-text" required hint={`${text.length}/${MAX_QUESTION} karakter. Tulis kalimat yang mudah diucapkan saat wawancara.`}>
          <Textarea
            id="question-text"
            value={text}
            onChange={(event) => {
              setText(event.target.value)
              if (error) setError(null)
            }}
            maxLength={MAX_QUESTION}
            className="min-h-24"
            placeholder="Contoh: Bagaimana Anda biasanya mengatur waktu belajar dalam seminggu?"
            invalid={Boolean(error && text.trim().length < 6)}
            autoFocus
          />
        </Field>

        <Field
          label="Panduan wawancara"
          htmlFor="question-guidance"
          optional
          hint="Catatan untuk pewawancara: hal yang perlu digali, contoh pertanyaan lanjutan, atau hal yang sebaiknya dihindari."
        >
          <Textarea
            id="question-guidance"
            value={guidance}
            onChange={(event) => setGuidance(event.target.value)}
            maxLength={MAX_GUIDANCE}
            className="min-h-20"
            placeholder="Contoh: Gali perbedaan antara hari kuliah dan akhir pekan."
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Bagian" htmlFor="question-section" hint="Bagian membantu mengelompokkan pertanyaan pada panduan dan ekspor.">
            <Select id="question-section" value={sectionId} onChange={(event) => setSectionId(event.target.value)}>
              <option value="">Tanpa bagian</option>
              {sections.map((section) => (
                <option key={section.id} value={section.id}>
                  {section.title}
                </option>
              ))}
            </Select>
          </Field>
          <div className="flex items-end pb-1">
            <Checkbox
              label="Pertanyaan wajib"
              description="Ditandai wajib pada panduan dan sesi."
              checked={required}
              onChange={(event) => setRequired(event.target.checked)}
            />
          </div>
        </div>

        {answers > 0 ? (
          <div className="rounded-[10px] border border-warn/30 bg-warn-soft px-3.5 py-3">
            <Checkbox
              label={`Saya mengerti perubahan ini memengaruhi ${answers} pertanyaan yang sudah dijawab.`}
              checked={acknowledged}
              onChange={(event) => {
                setAcknowledged(event.target.checked)
                if (error) setError(null)
              }}
            />
          </div>
        ) : null}

        {error ? <InlineNotice tone="danger">{error}</InlineNotice> : null}
      </div>
    </Modal>
  )
}

/* ------------------------------------------------------------------ */
/* Editor bagian                                                       */
/* ------------------------------------------------------------------ */

function SectionEditor({ draft, projectId, onClose }: { draft: SectionDraft | null; projectId: string; onClose: () => void }) {
  const { createSection, updateSection } = useWorkspace()
  const { notify } = useToast()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!draft) return
    setTitle(draft.section?.title ?? '')
    setDescription(draft.section?.description ?? '')
    setError(null)
    setBusy(false)
  }, [draft])

  const save = async () => {
    const value = title.trim()
    if (value.length < 2) {
      setError('Nama bagian minimal 2 karakter.')
      return
    }
    if (value.length > 80) {
      setError('Nama bagian maksimal 80 karakter.')
      return
    }
    setBusy(true)
    try {
      if (draft?.section) {
        await updateSection(draft.section.id, { title: value, description: description.trim() })
        notify('Bagian diperbarui.')
      } else if (draft) {
        const created = await createSection(projectId, value, description.trim())
        if (!created) {
          setError('Bagian tidak dapat dibuat. Coba lagi.')
          return
        }
        notify('Bagian ditambahkan.')
      }
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={Boolean(draft)}
      onClose={onClose}
      title={draft?.section ? 'Ubah bagian' : 'Tambah bagian'}
      description="Bagian mengelompokkan pertanyaan pada panduan, sesi, dan ekspor."
      size="sm"
      preventClose={busy}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Batal
          </Button>
          <Button variant="primary" onClick={() => void save()} disabled={busy || title.trim().length < 2}>
            {busy ? 'Menyimpan…' : draft?.section ? 'Simpan' : 'Tambah bagian'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Nama bagian" htmlFor="section-title" required hint={`${title.length}/80 karakter.`}>
          <Input
            id="section-title"
            value={title}
            onChange={(event) => {
              setTitle(event.target.value)
              if (error) setError(null)
            }}
            maxLength={80}
            placeholder="Contoh: Latar belakang belajar"
            autoFocus
          />
        </Field>
        <Field label="Deskripsi bagian" htmlFor="section-description" optional>
          <Textarea
            id="section-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={400}
            className="min-h-20"
            placeholder="Apa yang ingin digali pada bagian ini?"
          />
        </Field>
        {error ? <InlineNotice tone="danger">{error}</InlineNotice> : null}
      </div>
    </Modal>
  )
}

/* ------------------------------------------------------------------ */
/* Hapus pertanyaan                                                    */
/* ------------------------------------------------------------------ */

function DeleteQuestionDialog({
  question,
  answers,
  busy,
  onClose,
  onArchive,
  onDelete,
}: {
  question: Question | null
  answers: number
  busy: boolean
  onClose: () => void
  onArchive: () => void | Promise<void>
  onDelete: () => void
}) {
  const [understand, setUnderstand] = useState(false)

  useEffect(() => {
    setUnderstand(false)
  }, [question])

  if (!question) return null

  if (answers === 0) {
    return (
      <ConfirmDialog
        open
        onClose={onClose}
        onConfirm={onDelete}
        busy={busy}
        title="Hapus pertanyaan?"
        description="Pertanyaan ini belum memiliki jawaban."
        impact="Pertanyaan akan dihapus dari panduan dan dari daftar pertanyaan pada sesi yang belum diisi. Tindakan ini tidak dapat dibatalkan."
        confirmLabel="Hapus pertanyaan"
      />
    )
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Pertanyaan ini sudah memiliki jawaban"
      description={`“${truncate(question.text, 120)}”`}
      size="md"
      preventClose={busy}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Batal
          </Button>
          <Button variant="primary" icon="archive" onClick={() => void onArchive()} disabled={busy}>
            Nonaktifkan pertanyaan
          </Button>
          <Button variant="danger" icon="trash" onClick={onDelete} disabled={busy || !understand}>
            Hapus permanen
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <InlineNotice tone="warn" title={`${answers} jawaban akan ikut terhapus`}>
          Menghapus pertanyaan juga menghapus semua jawaban, coding, dan bukti tema yang terhubung. Nonaktifkan pertanyaan
          agar jawaban lama tetap tersimpan untuk analisis.
        </InlineNotice>
        <div className="rounded-[10px] border border-line bg-surface-2/60 px-3.5 py-3">
          <Checkbox
            label="Saya mengerti dan tetap ingin menghapus pertanyaan beserta jawabannya."
            checked={understand}
            onChange={(event) => setUnderstand(event.target.checked)}
          />
        </div>
      </div>
    </Modal>
  )
}
