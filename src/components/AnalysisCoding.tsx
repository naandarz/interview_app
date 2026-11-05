import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useWorkspace } from '../lib/store'
import type { Answer, Code as CodeRecord } from '../lib/types'
import { answerCodesFor, codeById } from '../lib/selectors'
import { formatDate, truncate } from '../lib/utils'
import { Icon } from '../components/Icon'
import {
  Button,
  ConfirmDialog,
  EmptyState,
  Field,
  IconButton,
  InlineNotice,
  Input,
  Modal,
  SearchInput,
  Select,
  StatusBadge,
  Textarea,
  cx,
  useToast,
} from '../components/ui'

const CODE_COLORS = ['#0F5A4E', '#A63A0C', '#1D4ED8', '#7C3AED', '#0E7490', '#B45309', '#C2410C', '#4D7C0F', '#9D174D', '#475569']

function CodeDialog({
  projectId,
  code,
  onClose,
}: {
  projectId: string
  code?: CodeRecord
  onClose: () => void
}) {
  const { data, createCode, updateCode } = useWorkspace()
  const { notify } = useToast()
  const [name, setName] = useState(code?.name ?? '')
  const [description, setDescription] = useState(code?.description ?? '')
  const [color, setColor] = useState(code?.color ?? CODE_COLORS[0])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    const clean = name.trim()
    if (!clean) {
      setError('Nama kode wajib diisi.')
      return
    }
    if (clean.length > 60) {
      setError('Nama kode maksimal 60 karakter.')
      return
    }
    const duplicate = data.codes.some(
      (item) => item.projectId === projectId && item.id !== code?.id && item.name.toLowerCase() === clean.toLowerCase(),
    )
    if (duplicate) {
      setError(`Kode “${clean}” sudah ada pada proyek ini.`)
      return
    }
    setBusy(true)
    try {
      if (code) {
        await updateCode(code.id, { name: clean, description: description.trim(), color })
        notify('Kode diperbarui.')
      } else {
        const created = await createCode(projectId, clean, description.trim(), color)
        if (!created) {
          setError('Kode tidak dapat disimpan. Periksa kembali nama kode.')
          return
        }
        notify('Kode baru dibuat.')
      }
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={code ? 'Ubah kode' : 'Kode baru'}
      description="Kode adalah label bermakna untuk menandai potongan jawaban. Kode yang baik punya batas yang jelas dan deskripsi singkat."
      size="md"
      preventClose={busy}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Batal
          </Button>
          <Button variant="primary" onClick={() => void submit()} disabled={busy}>
            {busy ? 'Menyimpan…' : code ? 'Simpan perubahan' : 'Buat kode'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Nama kode" htmlFor="code-name" required error={error}>
          <Input
            id="code-name"
            value={name}
            onChange={(event) => {
              setName(event.target.value)
              if (error) setError('')
            }}
            placeholder="Contoh: Belajar menunggu tenggat"
            autoFocus
            maxLength={60}
            invalid={Boolean(error)}
          />
        </Field>
        <Field label="Deskripsi" htmlFor="code-description" optional hint="Batas dan kriteria kapan kode ini dipakai.">
          <Textarea
            id="code-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Jelaskan makna kode agar konsisten saat dipakai pada jawaban lain."
            className="min-h-20"
            maxLength={400}
          />
        </Field>
        <div>
          <p className="mb-1.5 text-[13px] font-medium text-ink">Warna penanda</p>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Pilih warna kode">
            {CODE_COLORS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setColor(option)}
                aria-label={`Warna ${option}`}
                aria-pressed={color === option}
                className={cx(
                  'flex h-9 w-9 items-center justify-center rounded-full border-2 transition-[border-color,transform] duration-150',
                  color === option ? 'border-ink scale-105' : 'border-transparent hover:scale-105',
                )}
                style={{ backgroundColor: option }}
              >
                {color === option ? <Icon name="check" size={15} className="text-white" /> : null}
              </button>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  )
}

function CodingDialog({
  answer,
  projectId,
  onClose,
}: {
  answer: Answer
  projectId: string
  onClose: () => void
}) {
  const { data, addAnswerCode, deleteAnswerCode } = useWorkspace()
  const { notify } = useToast()
  const codes = useMemo(
    () => data.codes.filter((code) => code.projectId === projectId).sort((a, b) => a.name.localeCompare(b.name, 'id')),
    [data.codes, projectId],
  )
  const [codeId, setCodeId] = useState(codes[0]?.id ?? '')
  const [excerpt, setExcerpt] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const question = data.questions.find((item) => item.id === answer.questionId)
  const session = data.sessions.find((item) => item.id === answer.sessionId)
  const respondent = session ? data.respondents.find((item) => item.id === session.respondentId) : undefined
  const existing = answerCodesFor(data, answer.id)
  const sentences = answer.text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0)
    .slice(0, 24)

  useEffect(() => {
    if (!codeId && codes.length > 0) setCodeId(codes[0].id)
  }, [codeId, codes])

  const attach = async () => {
    if (!codeId) {
      setError('Pilih kode terlebih dahulu.')
      return
    }
    const cleanExcerpt = excerpt.trim()
    if (cleanExcerpt && !answer.text.includes(cleanExcerpt)) {
      setError('Kutipan harus berupa teks yang persis ada di dalam jawaban.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const created = await addAnswerCode({
        projectId,
        answerId: answer.id,
        codeId,
        excerpt: cleanExcerpt || null,
        note: note.trim(),
      })
      if (!created) {
        setError('Kode dengan kutipan yang sama sudah diterapkan pada jawaban ini.')
        return
      }
      notify('Kode diterapkan pada jawaban.')
      setExcerpt('')
      setNote('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Beri kode pada jawaban"
      description={respondent ? `${respondent.code}${respondent.displayName ? ` · ${respondent.displayName}` : ''}` : undefined}
      size="lg"
      preventClose={busy}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Tutup
          </Button>
          <Button variant="primary" icon="tag" onClick={() => void attach()} disabled={busy || codes.length === 0}>
            {busy ? 'Menerapkan…' : 'Terapkan kode'}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div>
          <p className="mono-meta uppercase text-ink-muted">Pertanyaan</p>
          <p className="mt-1 text-[13px] font-semibold leading-snug text-ink">{question?.text ?? 'Pertanyaan tidak ditemukan'}</p>
          {session ? (
            <p className="mt-0.5 text-[11px] text-ink-muted">
              {session.title} · {formatDate(session.interviewDate)} · {answer.status}
            </p>
          ) : null}
        </div>

        <div className="rounded-[10px] border border-line bg-surface-2/60 px-3.5 py-3">
          <p className="whitespace-pre-line text-[13px] leading-relaxed text-ink-soft">{answer.text}</p>
        </div>

        {codes.length === 0 ? (
          <InlineNotice tone="warn" title="Belum ada kode pada proyek ini">
            Buat kode terlebih dahulu dari panel kode, lalu kembali ke jawaban ini untuk menerapkannya.
          </InlineNotice>
        ) : (
          <>
            <fieldset>
              <legend className="mb-2 text-[13px] font-medium text-ink">Pilih kode</legend>
              <div className="grid max-h-52 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-2">
                {codes.map((code) => (
                  <label
                    key={code.id}
                    className={cx(
                      'flex cursor-pointer items-start gap-2.5 rounded-[9px] border px-3 py-2 transition-colors',
                      codeId === code.id ? 'border-primary bg-primary-soft/60' : 'border-line hover:bg-surface-2',
                    )}
                  >
                    <input
                      type="radio"
                      name="coding-code"
                      value={code.id}
                      checked={codeId === code.id}
                      onChange={() => setCodeId(code.id)}
                      className="mt-1 h-4 w-4 accent-[var(--primary)]"
                    />
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5 text-[13px] font-medium text-ink">
                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: code.color }} aria-hidden="true" />
                        {code.name}
                      </span>
                      {code.description ? <span className="mt-0.5 block text-[11px] leading-snug text-ink-muted">{truncate(code.description, 90)}</span> : null}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <Field label="Kutipan" htmlFor="coding-excerpt" optional hint="Pilih kalimat di bawah atau tulis potongan persis dari jawaban. Kosongkan untuk menandai seluruh jawaban.">
              <Textarea
                id="coding-excerpt"
                value={excerpt}
                onChange={(event) => {
                  setExcerpt(event.target.value)
                  if (error) setError('')
                }}
                placeholder="Tempel atau pilih potongan jawaban…"
                className="min-h-20"
                invalid={Boolean(error)}
              />
            </Field>
            {sentences.length > 1 ? (
              <div>
                <p className="mb-1.5 text-[11px] text-ink-muted">Pilih kalimat untuk dijadikan kutipan:</p>
                <div className="flex flex-wrap gap-1.5">
                  {sentences.map((sentence) => (
                    <button
                      key={sentence}
                      type="button"
                      onClick={() => {
                        setExcerpt(sentence)
                        setError('')
                      }}
                      className="max-w-full rounded-full border border-line bg-surface px-2.5 py-1 text-left text-[11px] leading-snug text-ink-soft transition-colors hover:border-primary hover:text-primary"
                    >
                      {truncate(sentence, 70)}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setExcerpt(answer.text)}
                    className="rounded-full border border-primary/30 bg-primary-soft px-2.5 py-1 text-[11px] font-medium text-primary"
                  >
                    Seluruh jawaban
                  </button>
                </div>
              </div>
            ) : (
              <Button size="sm" variant="ghost" onClick={() => setExcerpt(answer.text)}>
                Gunakan seluruh jawaban sebagai kutipan
              </Button>
            )}

            <Field label="Catatan kode" htmlFor="coding-note" optional>
              <Input
                id="coding-note"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Alasan memilih kode ini"
                maxLength={240}
              />
            </Field>

            {error ? (
              <p role="alert" className="flex items-start gap-1.5 text-xs leading-relaxed text-danger">
                <Icon name="alert" size={13} className="mt-0.5 shrink-0" />
                {error}
              </p>
            ) : null}
          </>
        )}

        {existing.length > 0 ? (
          <div className="border-t border-line pt-4">
            <p className="mb-2 text-[13px] font-medium text-ink">Kode yang sudah diterapkan</p>
            <ul className="space-y-2">
              {existing.map((link) => {
                const code = codeById(data, link.codeId)
                return (
                  <li key={link.id} className="flex items-start gap-2 rounded-[9px] border border-line px-3 py-2">
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: code?.color ?? '#667066' }} aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] font-medium text-ink">{code?.name ?? 'Kode tidak ditemukan'}</p>
                      {link.excerpt ? <p className="mt-0.5 line-clamp-2 text-[11px] italic text-ink-muted">“{link.excerpt}”</p> : <p className="mt-0.5 text-[11px] text-ink-muted">Seluruh jawaban.</p>}
                      {link.note ? <p className="mt-0.5 text-[11px] text-ink-muted">{link.note}</p> : null}
                    </div>
                    <IconButton
                      label="Hapus penerapan kode"
                      icon="trash"
                      size="sm"
                      danger
                      onClick={async () => {
                        await deleteAnswerCode(link.id)
                        notify('Penerapan kode dihapus.')
                      }}
                    />
                  </li>
                )
              })}
            </ul>
          </div>
        ) : null}
      </div>
    </Modal>
  )
}

export function AnalysisCoding({ projectId }: { projectId: string }) {
  const { data } = useWorkspace()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('semua')
  const [codeDialog, setCodeDialog] = useState<{ code?: CodeRecord } | null>(null)
  const [codingAnswerId, setCodingAnswerId] = useState<string | null>(null)
  const [deletingCode, setDeletingCode] = useState<CodeRecord | null>(null)
  const [busy, setBusy] = useState(false)
  const { deleteCode } = useWorkspace()
  const { notify } = useToast()

  const codes = useMemo(
    () => data.codes.filter((code) => code.projectId === projectId).sort((a, b) => a.name.localeCompare(b.name, 'id')),
    [data.codes, projectId],
  )

  const usage = useMemo(() => {
    const map = new Map<string, number>()
    for (const link of data.answerCodes) {
      if (link.projectId !== projectId) continue
      map.set(link.codeId, (map.get(link.codeId) ?? 0) + 1)
    }
    return map
  }, [data.answerCodes, projectId])

  const answers = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return data.answers
      .filter((answer) => answer.projectId === projectId && answer.text.trim().length > 0)
      .map((answer) => {
        const question = data.questions.find((item) => item.id === answer.questionId)
        const session = data.sessions.find((item) => item.id === answer.sessionId)
        const respondent = session ? data.respondents.find((item) => item.id === session.respondentId) : undefined
        const links = data.answerCodes.filter((link) => link.answerId === answer.id)
        return { answer, question, session, respondent, links }
      })
      .filter((row) => {
        if (!row.question) return false
        if (filter === 'belum' && row.links.length > 0) return false
        if (filter !== 'semua' && filter !== 'belum' && !row.links.some((link) => link.codeId === filter)) return false
        if (!needle) return true
        return [row.answer.text, row.question.text, row.respondent?.code ?? '', row.respondent?.displayName ?? '']
          .join(' ')
          .toLowerCase()
          .includes(needle)
      })
      .sort((a, b) => (a.question?.orderIndex ?? 0) - (b.question?.orderIndex ?? 0))
  }, [data, projectId, query, filter])

  const codingAnswer = codingAnswerId ? data.answers.find((answer) => answer.id === codingAnswerId) : undefined
  const codedAnswers = new Set(data.answerCodes.filter((link) => link.projectId === projectId).map((link) => link.answerId)).size
  const totalFilled = data.answers.filter((answer) => answer.projectId === projectId && answer.text.trim().length > 0).length
  const selectedCode = filter !== 'semua' && filter !== 'belum' ? codeById(data, filter) : undefined

  const confirmDelete = async () => {
    if (!deletingCode) return
    setBusy(true)
    try {
      await deleteCode(deletingCode.id)
      notify('Kode dan seluruh penerapannya dihapus.')
      if (filter === deletingCode.id) setFilter('semua')
      setDeletingCode(null)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)] lg:items-start">
      <aside className="space-y-3 lg:sticky lg:top-20">
        <section className="rounded-[12px] border border-line bg-surface p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="text-[14px] font-semibold text-ink">Daftar kode</h2>
              <p className="mt-0.5 text-[11px] text-ink-muted">{codes.length} kode · {usage.size} dipakai</p>
            </div>
            <IconButton label="Buat kode baru" icon="plus" variant="quiet" size="sm" onClick={() => setCodeDialog({})} />
          </div>

          {codes.length === 0 ? (
            <div className="mt-3 rounded-[9px] border border-dashed border-line-strong px-3 py-4 text-center">
              <p className="text-[12px] font-medium text-ink">Belum ada kode</p>
              <p className="mt-1 text-[11px] leading-relaxed text-ink-muted">Buat kode pertama untuk mulai menandai makna jawaban.</p>
              <Button size="sm" variant="primary" icon="plus" className="mt-2.5" onClick={() => setCodeDialog({})}>
                Buat kode
              </Button>
            </div>
          ) : (
            <div className="mt-3 space-y-1">
              <button
                type="button"
                onClick={() => setFilter('semua')}
                className={cx(
                  'flex min-h-9 w-full items-center justify-between gap-2 rounded-[8px] px-2 py-1.5 text-left text-[12px] transition-colors',
                  filter === 'semua' ? 'bg-primary-soft font-medium text-primary' : 'text-ink-soft hover:bg-surface-2',
                )}
              >
                Semua jawaban
                <span className="mono-meta text-[10px] text-ink-muted">{totalFilled}</span>
              </button>
              <button
                type="button"
                onClick={() => setFilter('belum')}
                className={cx(
                  'flex min-h-9 w-full items-center justify-between gap-2 rounded-[8px] px-2 py-1.5 text-left text-[12px] transition-colors',
                  filter === 'belum' ? 'bg-primary-soft font-medium text-primary' : 'text-ink-soft hover:bg-surface-2',
                )}
              >
                Belum dikode
                <span className="mono-meta text-[10px] text-ink-muted">{totalFilled - codedAnswers}</span>
              </button>
              <div className="my-2 h-px bg-line" />
              {codes.map((code) => (
                <div
                  key={code.id}
                  className={cx(
                    'group flex items-center gap-1 rounded-[8px] pr-1 transition-colors',
                    filter === code.id ? 'bg-primary-soft' : 'hover:bg-surface-2',
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setFilter(filter === code.id ? 'semua' : code.id)}
                    className={cx(
                      'flex min-h-9 min-w-0 flex-1 items-center gap-2 rounded-[8px] px-2 py-1.5 text-left text-[12px] transition-colors',
                      filter === code.id ? 'font-medium text-primary' : 'text-ink-soft',
                    )}
                  >
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: code.color }} aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate">{code.name}</span>
                    <span className="mono-meta shrink-0 text-[10px] text-ink-muted">{usage.get(code.id) ?? 0}</span>
                  </button>
                  <div className="flex shrink-0 items-center opacity-100 lg:opacity-0 lg:group-hover:opacity-100 lg:group-focus-within:opacity-100">
                    <IconButton label={`Ubah kode ${code.name}`} icon="edit" size="sm" onClick={() => setCodeDialog({ code })} />
                    <IconButton label={`Hapus kode ${code.name}`} icon="trash" size="sm" danger onClick={() => setDeletingCode(code)} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-[12px] border border-line bg-surface-2/50 px-3.5 py-3">
          <p className="mono-meta uppercase text-ink-muted">Cakupan coding</p>
          <p className="mt-1 text-lg font-semibold text-ink">
            {totalFilled === 0 ? '0%' : `${Math.round((codedAnswers / totalFilled) * 100)}%`}
          </p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-ink-muted">
            {codedAnswers} dari {totalFilled} jawaban terisi memiliki setidaknya satu kode. Coding membantu penelusuran,
            bukan menilai kualitas jawaban.
          </p>
        </section>
      </aside>

      <section className="min-w-0">
        <div className="rounded-[12px] border border-line bg-surface">
          <div className="flex flex-col gap-3 border-b border-line px-4 py-3.5 sm:px-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="text-[15px] font-semibold text-ink">
                  {selectedCode ? `Jawaban dengan kode “${selectedCode.name}”` : filter === 'belum' ? 'Jawaban belum dikode' : 'Semua jawaban terisi'}
                </h2>
                <p className="mt-0.5 text-xs text-ink-muted">
                  {answers.length} jawaban ditampilkan. Pilih satu jawaban untuk menerapkan kode dan kutipan.
                </p>
              </div>
              {query || filter !== 'semua' ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setQuery('')
                    setFilter('semua')
                  }}
                >
                  Reset
                </Button>
              ) : null}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <SearchInput value={query} onChange={setQuery} placeholder="Cari teks jawaban atau pertanyaan…" className="sm:flex-1" />
              <Select value={filter} onChange={(event) => setFilter(event.target.value)} aria-label="Filter coding" className="text-[13px] sm:w-52">
                <option value="semua">Semua jawaban</option>
                <option value="belum">Belum dikode</option>
                {codes.map((code) => (
                  <option key={code.id} value={code.id}>
                    {code.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {totalFilled === 0 ? (
            <div className="p-4 sm:p-5">
              <EmptyState
                icon="data"
                title="Belum ada jawaban untuk dikode"
                description="Isi jawaban pada sesi wawancara terlebih dahulu. Coding dilakukan setelah ada teks jawaban yang tersimpan."
                action={
                  <Link to={`/p/${projectId}/sesi`}>
                    <Button variant="primary" icon="session">
                      Buka sesi
                    </Button>
                  </Link>
                }
              />
            </div>
          ) : answers.length === 0 ? (
            <div className="p-4 sm:p-5">
              <EmptyState
                icon="search"
                title="Tidak ada jawaban yang cocok"
                description="Ubah kata kunci atau pilih filter lain. Filter “belum dikode” membantu menemukan jawaban yang belum ditandai."
                action={
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setQuery('')
                      setFilter('semua')
                    }}
                  >
                    Reset filter
                  </Button>
                }
              />
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {answers.map((row) => (
                <li key={row.answer.id} className="px-4 py-4 transition-colors hover:bg-surface-2/25 sm:px-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="mono-meta rounded bg-surface-2 px-1.5 py-0.5 text-ink-soft">{row.respondent?.code ?? 'Tanpa kode'}</span>
                    <StatusBadge status={row.answer.status} />
                    {row.session ? <span className="text-[11px] text-ink-muted">{formatDate(row.session.interviewDate)}</span> : null}
                    <Button
                      size="sm"
                      variant={row.links.length > 0 ? 'ghost' : 'secondary'}
                      icon="tag"
                      className="ml-auto"
                      onClick={() => setCodingAnswerId(row.answer.id)}
                    >
                      {row.links.length > 0 ? 'Kelola kode' : 'Beri kode'}
                    </Button>
                  </div>
                  <p className="mt-2 text-[13px] font-semibold leading-snug text-ink">{row.question?.text}</p>
                  <p className="mt-1.5 whitespace-pre-line border-l-2 border-line-strong pl-3 text-[13px] leading-relaxed text-ink-soft">
                    {row.answer.text}
                  </p>
                  {row.links.length > 0 ? (
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {row.links.map((link) => {
                        const code = codeById(data, link.codeId)
                        return (
                          <span
                            key={link.id}
                            className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] text-ink-soft"
                            style={{ borderColor: `${code?.color ?? '#667066'}55`, backgroundColor: `${code?.color ?? '#667066'}12` }}
                          >
                            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: code?.color ?? '#667066' }} aria-hidden="true" />
                            {code?.name ?? 'Kode tidak ditemukan'}
                            {link.excerpt ? <span className="text-ink-muted">· kutipan</span> : null}
                          </span>
                        )
                      })}
                    </div>
                  ) : (
                    <p className="mt-2 text-[11px] text-ink-muted">Belum memiliki kode.</p>
                  )}
                  {row.links.some((link) => link.excerpt && !row.answer.text.includes(link.excerpt)) ? (
                    <p className="mt-2 flex items-start gap-1.5 text-[11px] text-warn">
                      <Icon name="alert" size={12} className="mt-0.5 shrink-0" />
                      Ada kutipan yang tidak lagi ditemukan pada teks jawaban. Buka “Kelola kode” untuk meninjau.
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {codeDialog ? (
        <CodeDialog key={codeDialog.code?.id ?? 'baru'} projectId={projectId} code={codeDialog.code} onClose={() => setCodeDialog(null)} />
      ) : null}
      {codingAnswer ? <CodingDialog key={codingAnswer.id} answer={codingAnswer} projectId={projectId} onClose={() => setCodingAnswerId(null)} /> : null}

      <ConfirmDialog
        open={Boolean(deletingCode)}
        onClose={() => setDeletingCode(null)}
        onConfirm={() => void confirmDelete()}
        busy={busy}
        title={deletingCode ? `Hapus kode “${deletingCode.name}”?` : 'Hapus kode?'}
        description="Tindakan ini tidak dapat dibatalkan."
        impact={
          deletingCode
            ? `${usage.get(deletingCode.id) ?? 0} penerapan kode pada jawaban akan dihapus. Teks jawaban dan hubungan kategori kode ini juga dilepas. Jawaban asli tetap tersimpan.`
            : ''
        }
        confirmLabel="Hapus kode"
      />
    </div>
  )
}
