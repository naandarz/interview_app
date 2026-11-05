import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useWorkspace } from '../lib/store'
import type { Category, Theme } from '../lib/types'
import { codeById } from '../lib/selectors'
import { formatDate, truncate } from '../lib/utils'
import { Icon } from '../components/Icon'
import {
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  Field,
  IconButton,
  InlineNotice,
  Input,
  Modal,
  SearchInput,
  Textarea,
  cx,
  useToast,
} from '../components/ui'

function CategoryDialog({
  projectId,
  category,
  onClose,
}: {
  projectId: string
  category?: Category
  onClose: () => void
}) {
  const { data, createCategory, updateCategory } = useWorkspace()
  const { notify } = useToast()
  const [name, setName] = useState(category?.name ?? '')
  const [description, setDescription] = useState(category?.description ?? '')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    const clean = name.trim()
    if (!clean) {
      setError('Nama kategori wajib diisi.')
      return
    }
    const duplicate = data.categories.some(
      (item) => item.projectId === projectId && item.id !== category?.id && item.name.toLowerCase() === clean.toLowerCase(),
    )
    if (duplicate) {
      setError(`Kategori “${clean}” sudah ada pada proyek ini.`)
      return
    }
    setBusy(true)
    try {
      if (category) {
        await updateCategory(category.id, { name: clean, description: description.trim() })
        notify('Kategori diperbarui.')
      } else {
        const created = await createCategory(projectId, clean, description.trim())
        if (!created) {
          setError('Kategori tidak dapat disimpan. Periksa kembali nama kategori.')
          return
        }
        notify('Kategori baru dibuat.')
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
      title={category ? 'Ubah kategori' : 'Kategori baru'}
      description="Kategori mengelompokkan kode yang membahas gagasan serupa. Kategori belum merupakan tema."
      preventClose={busy}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Batal
          </Button>
          <Button variant="primary" onClick={() => void submit()} disabled={busy}>
            {busy ? 'Menyimpan…' : category ? 'Simpan perubahan' : 'Buat kategori'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Nama kategori" htmlFor="category-name" required error={error}>
          <Input
            id="category-name"
            value={name}
            onChange={(event) => {
              setName(event.target.value)
              if (error) setError('')
            }}
            placeholder="Contoh: Pengaturan diri"
            autoFocus
            maxLength={60}
            invalid={Boolean(error)}
          />
        </Field>
        <Field label="Deskripsi" htmlFor="category-description" optional hint="Jelaskan gagasan yang menyatukan kode-kode di dalamnya.">
          <Textarea
            id="category-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Batas kategori ini…"
            className="min-h-20"
            maxLength={400}
          />
        </Field>
      </div>
    </Modal>
  )
}

function ThemeDialog({
  projectId,
  theme,
  onClose,
}: {
  projectId: string
  theme?: Theme
  onClose: () => void
}) {
  const { data, createTheme, updateTheme } = useWorkspace()
  const { notify } = useToast()
  const [name, setName] = useState(theme?.name ?? '')
  const [description, setDescription] = useState(theme?.description ?? '')
  const [interpretation, setInterpretation] = useState(theme?.interpretation ?? '')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    const clean = name.trim()
    if (!clean) {
      setError('Nama tema wajib diisi.')
      return
    }
    const duplicate = data.themes.some(
      (item) => item.projectId === projectId && item.id !== theme?.id && item.name.toLowerCase() === clean.toLowerCase(),
    )
    if (duplicate) {
      setError(`Tema “${clean}” sudah ada pada proyek ini.`)
      return
    }
    setBusy(true)
    try {
      if (theme) {
        await updateTheme(theme.id, { name: clean, description: description.trim(), interpretation: interpretation.trim() })
        notify('Tema diperbarui.')
      } else {
        const created = await createTheme(projectId, clean, description.trim(), interpretation.trim())
        if (!created) {
          setError('Tema tidak dapat disimpan. Periksa kembali nama tema.')
          return
        }
        notify('Tema baru dibuat.')
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
      title={theme ? 'Ubah tema' : 'Tema baru'}
      description="Tema adalah interpretasi peneliti atas pola yang muncul dari kategori dan bukti jawaban. Tema bukan hasil otomatis aplikasi."
      size="lg"
      preventClose={busy}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Batal
          </Button>
          <Button variant="primary" onClick={() => void submit()} disabled={busy}>
            {busy ? 'Menyimpan…' : theme ? 'Simpan perubahan' : 'Buat tema'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Nama tema" htmlFor="theme-name" required error={error}>
          <Input
            id="theme-name"
            value={name}
            onChange={(event) => {
              setName(event.target.value)
              if (error) setError('')
            }}
            placeholder="Contoh: Belajar reaktif menjelang tenggat"
            autoFocus
            maxLength={80}
            invalid={Boolean(error)}
          />
        </Field>
        <Field label="Deskripsi pola" htmlFor="theme-description" optional hint="Apa yang berulang dan pada konteks apa.">
          <Textarea
            id="theme-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Uraikan pola yang terlihat dari jawaban…"
            maxLength={1200}
          />
        </Field>
        <Field
          label="Interpretasi"
          htmlFor="theme-interpretation"
          optional
          hint="Makna atau penjelasan peneliti. Tulis sebagai penafsiran, bukan fakta otomatis."
        >
          <Textarea
            id="theme-interpretation"
            value={interpretation}
            onChange={(event) => setInterpretation(event.target.value)}
            placeholder="Mengapa pola ini penting…"
            maxLength={1600}
          />
        </Field>
      </div>
    </Modal>
  )
}

function EvidenceDialog({
  projectId,
  theme,
  onClose,
}: {
  projectId: string
  theme: Theme
  onClose: () => void
}) {
  const { data, addThemeEvidence } = useWorkspace()
  const { notify } = useToast()
  const [query, setQuery] = useState('')
  const [answerId, setAnswerId] = useState('')
  const [excerpt, setExcerpt] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const existingAnswerIds = new Set(
    data.themeEvidence.filter((item) => item.themeId === theme.id).map((item) => item.answerId),
  )

  const answers = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return data.answers
      .filter((answer) => answer.projectId === projectId && answer.text.trim().length > 0)
      .map((answer) => {
        const question = data.questions.find((item) => item.id === answer.questionId)
        const session = data.sessions.find((item) => item.id === answer.sessionId)
        const respondent = session ? data.respondents.find((item) => item.id === session.respondentId) : undefined
        return { answer, question, session, respondent }
      })
      .filter((row) => {
        if (!row.question) return false
        if (existingAnswerIds.has(row.answer.id)) return false
        if (!needle) return true
        return [row.answer.text, row.question.text, row.respondent?.code ?? '', row.respondent?.displayName ?? '']
          .join(' ')
          .toLowerCase()
          .includes(needle)
      })
  }, [data, projectId, query, existingAnswerIds])

  const selected = data.answers.find((answer) => answer.id === answerId)
  const sentences = selected
    ? selected.text
        .split(/(?<=[.!?])\s+/)
        .map((sentence) => sentence.trim())
        .filter(Boolean)
        .slice(0, 24)
    : []

  const submit = async () => {
    if (!selected) {
      setError('Pilih jawaban sumber terlebih dahulu.')
      return
    }
    const clean = excerpt.trim()
    if (!clean) {
      setError('Kutipan bukti wajib diisi.')
      return
    }
    if (!selected.text.includes(clean)) {
      setError('Kutipan harus berupa teks yang persis ada di dalam jawaban sumber.')
      return
    }
    setBusy(true)
    try {
      const created = await addThemeEvidence({
        projectId,
        themeId: theme.id,
        answerId: selected.id,
        excerpt: clean,
        note: note.trim(),
      })
      if (!created) {
        setError('Jawaban ini sudah menjadi bukti untuk tema tersebut.')
        return
      }
      notify('Bukti sumber ditambahkan ke tema.')
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Tambah bukti untuk “${truncate(theme.name, 48)}”`}
      description="Bukti harus berasal dari jawaban yang tersimpan. Kutipan membantu pembaca menelusuri tema ke data asli."
      size="lg"
      preventClose={busy}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Batal
          </Button>
          <Button variant="primary" icon="quote" onClick={() => void submit()} disabled={busy}>
            {busy ? 'Menyimpan…' : 'Tambah bukti'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {!selected ? (
          <>
            <SearchInput value={query} onChange={setQuery} placeholder="Cari jawaban sumber…" />
            {answers.length === 0 ? (
              <InlineNotice tone="info">
                {existingAnswerIds.size > 0
                  ? 'Semua jawaban terisi sudah menjadi bukti tema ini, atau tidak ada yang cocok dengan pencarian.'
                  : 'Belum ada jawaban terisi yang dapat dijadikan bukti.'}
              </InlineNotice>
            ) : (
              <ul className="max-h-80 divide-y divide-line overflow-y-auto rounded-[10px] border border-line">
                {answers.map((row) => (
                  <li key={row.answer.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setAnswerId(row.answer.id)
                        setExcerpt('')
                        setError('')
                      }}
                      className="flex w-full flex-col gap-1 px-3.5 py-3 text-left transition-colors hover:bg-surface-2"
                    >
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="mono-meta rounded bg-surface-2 px-1.5 py-0.5 text-ink-soft">{row.respondent?.code ?? 'Tanpa kode'}</span>
                        <span className="text-[11px] text-ink-muted">{row.question?.text}</span>
                      </span>
                      <span className="line-clamp-2 text-[12px] leading-relaxed text-ink-soft">{row.answer.text}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="mono-meta uppercase text-ink-muted">Jawaban sumber</p>
                <p className="mt-0.5 text-[12px] font-semibold text-ink">
                  {data.questions.find((question) => question.id === selected.questionId)?.text}
                </p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setAnswerId('')}>
                Ganti jawaban
              </Button>
            </div>
            <div className="rounded-[10px] border border-line bg-surface-2/60 px-3.5 py-3">
              <p className="whitespace-pre-line text-[13px] leading-relaxed text-ink-soft">{selected.text}</p>
            </div>
            <Field label="Kutipan bukti" htmlFor="evidence-excerpt" required error={error}>
              <Textarea
                id="evidence-excerpt"
                value={excerpt}
                onChange={(event) => {
                  setExcerpt(event.target.value)
                  if (error) setError('')
                }}
                placeholder="Pilih kalimat di bawah atau tulis potongan persis dari jawaban…"
                className="min-h-20"
                invalid={Boolean(error)}
              />
            </Field>
            {sentences.length > 0 ? (
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
              </div>
            ) : null}
            <Field label="Catatan" htmlFor="evidence-note" optional>
              <Input
                id="evidence-note"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Mengapa kutipan ini mendukung tema"
                maxLength={240}
              />
            </Field>
          </>
        )}
      </div>
    </Modal>
  )
}

function ThemeCard({
  projectId,
  theme,
  categories,
  onEdit,
  onDelete,
}: {
  projectId: string
  theme: Theme
  categories: Category[]
  onEdit: () => void
  onDelete: () => void
}) {
  const { data, toggleThemeCategory, createMemo, deleteMemo, deleteThemeEvidence } = useWorkspace()
  const { notify } = useToast()
  const [evidenceOpen, setEvidenceOpen] = useState(false)
  const [memo, setMemo] = useState('')
  const [memoBusy, setMemoBusy] = useState(false)
  const [pendingEvidence, setPendingEvidence] = useState<string | null>(null)
  const [pendingMemo, setPendingMemo] = useState<string | null>(null)

  const linkedCategoryIds = new Set(
    data.themeCategories.filter((link) => link.themeId === theme.id).map((link) => link.categoryId),
  )
  const evidence = data.themeEvidence.filter((item) => item.themeId === theme.id)
  const memos = data.memos.filter((item) => item.themeId === theme.id)
  const linkedCodes = data.categories
    .filter((category) => linkedCategoryIds.has(category.id))
    .flatMap((category) =>
      data.codeCategories
        .filter((link) => link.categoryId === category.id)
        .map((link) => codeById(data, link.codeId))
        .filter((code): code is NonNullable<typeof code> => Boolean(code)),
    )

  const saveMemo = async () => {
    if (!memo.trim()) return
    setMemoBusy(true)
    try {
      const created = await createMemo(projectId, theme.id, memo)
      if (created) {
        setMemo('')
        notify('Memo tema disimpan.')
      }
    } finally {
      setMemoBusy(false)
    }
  }

  return (
    <article className="rounded-[12px] border border-line bg-surface">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-3.5 sm:px-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[15px] font-semibold leading-snug text-ink">{theme.name}</h3>
            <Badge tone={evidence.length > 0 ? 'success' : 'danger'}>{evidence.length} bukti</Badge>
            {linkedCodes.length > 0 ? <Badge tone="info">{linkedCodes.length} kode</Badge> : null}
          </div>
          {theme.description ? <p className="mt-1 text-[12px] leading-relaxed text-ink-soft">{theme.description}</p> : null}
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <IconButton label={`Ubah tema ${theme.name}`} icon="edit" size="sm" onClick={onEdit} />
          <IconButton label={`Hapus tema ${theme.name}`} icon="trash" size="sm" danger onClick={onDelete} />
        </div>
      </div>

      <div className="space-y-4 px-4 py-4 sm:px-5">
        {theme.interpretation ? (
          <div className="rounded-[9px] border-l-2 border-primary/40 bg-primary-soft/30 px-3.5 py-2.5">
            <p className="mono-meta uppercase text-primary/80">Interpretasi</p>
            <p className="mt-1 whitespace-pre-line text-[12px] leading-relaxed text-ink-soft">{theme.interpretation}</p>
          </div>
        ) : (
          <p className="text-[12px] italic text-ink-muted">Interpretasi belum diisi. Gunakan tombol ubah untuk menambahkan makna tema.</p>
        )}

        <div>
          <p className="mb-1.5 text-[12px] font-medium text-ink">Kategori pendukung</p>
          {categories.length === 0 ? (
            <p className="text-[11px] text-ink-muted">Belum ada kategori. Buat kategori terlebih dahulu.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {categories.map((category) => {
                const active = linkedCategoryIds.has(category.id)
                return (
                  <button
                    key={category.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => void toggleThemeCategory(projectId, theme.id, category.id)}
                    className={cx(
                      'inline-flex min-h-8 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] transition-colors',
                      active ? 'border-primary bg-primary-soft font-medium text-primary' : 'border-line text-ink-muted hover:border-line-strong hover:text-ink',
                    )}
                  >
                    <span className={cx('h-1.5 w-1.5 rounded-full', active ? 'bg-primary' : 'bg-line-strong')} aria-hidden="true" />
                    {category.name}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[12px] font-medium text-ink">Bukti sumber</p>
            <Button size="sm" variant="secondary" icon="plus" onClick={() => setEvidenceOpen(true)}>
              Tambah bukti
            </Button>
          </div>
          {evidence.length === 0 ? (
            <p className="mt-1.5 rounded-[9px] border border-dashed border-line-strong px-3 py-3 text-[11px] leading-relaxed text-ink-muted">
              Tema ini belum memiliki kutipan pendukung. Tanpa bukti, tema tidak dapat ditelusuri ke jawaban asli.
            </p>
          ) : (
            <ul className="mt-2 space-y-2">
              {evidence.map((item) => {
                const answer = data.answers.find((entry) => entry.id === item.answerId)
                const session = answer ? data.sessions.find((entry) => entry.id === answer.sessionId) : undefined
                const respondent = session ? data.respondents.find((entry) => entry.id === session.respondentId) : undefined
                return (
                  <li key={item.id} className="group flex items-start gap-2 rounded-[9px] border border-line bg-surface px-3 py-2.5">
                    <Icon name="quote" size={14} className="mt-0.5 shrink-0 text-ink-muted" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] italic leading-relaxed text-ink-soft">“{item.excerpt}”</p>
                      <p className="mt-1 text-[10px] text-ink-muted">
                        {respondent?.code ?? 'Narasumber tidak ditemukan'}
                        {session ? ` · ${formatDate(session.interviewDate)}` : ''}
                        {item.note ? ` · ${item.note}` : ''}
                      </p>
                    </div>
                    <IconButton label="Hapus bukti" icon="trash" size="sm" danger onClick={() => setPendingEvidence(item.id)} />
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div className="border-t border-line pt-3">
          <p className="text-[12px] font-medium text-ink">Memo tema</p>
          {memos.length > 0 ? (
            <ul className="mt-1.5 space-y-1.5">
              {memos.map((item) => (
                <li key={item.id} className="group flex items-start gap-2 rounded-[8px] bg-surface-2/60 px-2.5 py-2">
                  <p className="min-w-0 flex-1 whitespace-pre-line text-[11px] leading-relaxed text-ink-soft">{item.content}</p>
                  <IconButton label="Hapus memo" icon="trash" size="sm" danger onClick={() => setPendingMemo(item.id)} />
                </li>
              ))}
            </ul>
          ) : null}
          <div className="mt-2 flex flex-col gap-1.5 sm:flex-row">
            <Input
              value={memo}
              onChange={(event) => setMemo(event.target.value)}
              placeholder="Tulis memo untuk tema ini…"
              aria-label={`Memo untuk ${theme.name}`}
              maxLength={600}
              className="text-[13px]"
            />
            <Button size="sm" variant="secondary" icon="note" onClick={() => void saveMemo()} disabled={memoBusy || !memo.trim()}>
              {memoBusy ? 'Menyimpan…' : 'Simpan memo'}
            </Button>
          </div>
        </div>
      </div>

      {evidenceOpen ? <EvidenceDialog projectId={projectId} theme={theme} onClose={() => setEvidenceOpen(false)} /> : null}

      <ConfirmDialog
        open={Boolean(pendingEvidence)}
        onClose={() => setPendingEvidence(null)}
        onConfirm={async () => {
          if (!pendingEvidence) return
          await deleteThemeEvidence(pendingEvidence)
          notify('Bukti dihapus dari tema. Jawaban asli tetap tersimpan.')
          setPendingEvidence(null)
        }}
        title="Hapus bukti tema?"
        description="Kutipan ini akan dilepas dari tema."
        impact="Jawaban sumber, kode, dan kategori tidak berubah. Tema tetap ada, tetapi bukti yang dihapus tidak lagi ditampilkan pada laporan."
        confirmLabel="Hapus bukti"
      />

      <ConfirmDialog
        open={Boolean(pendingMemo)}
        onClose={() => setPendingMemo(null)}
        onConfirm={async () => {
          if (!pendingMemo) return
          await deleteMemo(pendingMemo)
          notify('Memo dihapus.')
          setPendingMemo(null)
        }}
        title="Hapus memo?"
        description="Tindakan ini tidak dapat dibatalkan."
        impact="Teks memo akan dihapus permanen dari tema ini."
        confirmLabel="Hapus memo"
      />
    </article>
  )
}

function GeneralMemos({ projectId }: { projectId: string }) {
  const { data, createMemo, deleteMemo } = useWorkspace()
  const { notify } = useToast()
  const [content, setContent] = useState('')
  const [busy, setBusy] = useState(false)
  const [pending, setPending] = useState<string | null>(null)
  const memos = data.memos.filter((memo) => memo.projectId === projectId && memo.themeId === null)

  const submit = async () => {
    if (!content.trim()) return
    setBusy(true)
    try {
      const created = await createMemo(projectId, null, content)
      if (created) {
        setContent('')
        notify('Memo umum disimpan.')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-[12px] border border-line bg-surface px-4 py-4 sm:px-5" aria-labelledby="memo-umum">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 id="memo-umum" className="text-[15px] font-semibold text-ink">
            Memo umum
          </h2>
          <p className="mt-0.5 text-xs text-ink-muted">Catatan analisis yang tidak terikat pada satu tema. Tidak muncul sebagai tema pada laporan.</p>
        </div>
        <Badge tone="neutral">{memos.length} memo</Badge>
      </div>
      {memos.length > 0 ? (
        <ul className="mt-3 space-y-1.5">
          {memos.map((memo) => (
            <li key={memo.id} className="flex items-start gap-2 rounded-[9px] border border-line px-3 py-2.5">
              <Icon name="note" size={14} className="mt-0.5 shrink-0 text-ink-muted" />
              <div className="min-w-0 flex-1">
                <p className="whitespace-pre-line text-[12px] leading-relaxed text-ink-soft">{memo.content}</p>
                <p className="mt-1 text-[10px] text-ink-muted">Dibuat {formatDate(memo.createdAt, true)}</p>
              </div>
              <IconButton label="Hapus memo umum" icon="trash" size="sm" danger onClick={() => setPending(memo.id)} />
            </li>
          ))}
        </ul>
      ) : null}
      <div className="mt-3 flex flex-col gap-1.5 sm:flex-row sm:items-start">
        <Textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder="Catatan lintas tema, pertanyaan untuk data lanjutan, atau batasan analisis…"
          aria-label="Memo umum baru"
          className="min-h-16 text-[13px]"
          maxLength={800}
        />
        <Button size="sm" variant="secondary" icon="save" onClick={() => void submit()} disabled={busy || !content.trim()} className="shrink-0">
          {busy ? 'Menyimpan…' : 'Tambah memo'}
        </Button>
      </div>

      <ConfirmDialog
        open={Boolean(pending)}
        onClose={() => setPending(null)}
        onConfirm={async () => {
          if (!pending) return
          await deleteMemo(pending)
          notify('Memo umum dihapus.')
          setPending(null)
        }}
        title="Hapus memo umum?"
        description="Tindakan ini tidak dapat dibatalkan."
        impact="Teks memo akan dihapus permanen."
        confirmLabel="Hapus memo"
      />
    </section>
  )
}

export function AnalysisThemes({ projectId }: { projectId: string }) {
  const { data, toggleCodeCategory, deleteCategory, deleteTheme } = useWorkspace()
  const { notify } = useToast()
  const [categoryDialog, setCategoryDialog] = useState<{ category?: Category } | null>(null)
  const [themeDialog, setThemeDialog] = useState<{ theme?: Theme } | null>(null)
  const [deletingCategory, setDeletingCategory] = useState<Category | null>(null)
  const [deletingTheme, setDeletingTheme] = useState<Theme | null>(null)
  const [busy, setBusy] = useState(false)

  const codes = useMemo(
    () => data.codes.filter((code) => code.projectId === projectId).sort((a, b) => a.name.localeCompare(b.name, 'id')),
    [data.codes, projectId],
  )
  const categories = useMemo(
    () => data.categories.filter((category) => category.projectId === projectId).sort((a, b) => a.name.localeCompare(b.name, 'id')),
    [data.categories, projectId],
  )
  const themes = useMemo(
    () => data.themes.filter((theme) => theme.projectId === projectId).sort((a, b) => a.name.localeCompare(b.name, 'id')),
    [data.themes, projectId],
  )

  const categoryUsage = (categoryId: string) => ({
    codes: data.codeCategories.filter((link) => link.categoryId === categoryId).length,
    themes: data.themeCategories.filter((link) => link.categoryId === categoryId).length,
  })

  const confirmDeleteCategory = async () => {
    if (!deletingCategory) return
    setBusy(true)
    try {
      await deleteCategory(deletingCategory.id)
      notify('Kategori dihapus. Kode dan tema tetap tersimpan.')
      setDeletingCategory(null)
    } finally {
      setBusy(false)
    }
  }

  const confirmDeleteTheme = async () => {
    if (!deletingTheme) return
    setBusy(true)
    try {
      await deleteTheme(deletingTheme.id)
      notify('Tema, bukti, dan hubungan kategorinya dihapus.')
      setDeletingTheme(null)
    } finally {
      setBusy(false)
    }
  }

  const uncodedCount = data.answers.filter((answer) => answer.projectId === projectId && answer.text.trim().length > 0).length

  return (
    <div className="space-y-5">
      <InlineNotice tone="info" title="Alur analisis: kode, kategori, lalu tema">
        Kode menandai potongan jawaban. Kategori mengelompokkan kode. Tema merangkum pola dan wajib punya bukti kutipan.
        Semua bagian ini adalah interpretasi peneliti, bukan hasil otomatis.
      </InlineNotice>

      {uncodedCount === 0 ? (
        <InlineNotice
          tone="warn"
          title="Belum ada jawaban terisi untuk dianalisis"
          action={
            <Link to={`/p/${projectId}/sesi`}>
              <Button size="sm" variant="secondary" icon="session">
                Buka sesi
              </Button>
            </Link>
          }
        >
          Isi jawaban terlebih dahulu. Kategori dan tema sebaiknya dibangun dari kode yang melekat pada kutipan nyata.
        </InlineNotice>
      ) : null}

      <section className="rounded-[12px] border border-line bg-surface" aria-labelledby="kategori-analisis">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-3.5 sm:px-5">
          <div>
            <h2 id="kategori-analisis" className="text-[15px] font-semibold text-ink">
              Kategori
            </h2>
            <p className="mt-0.5 text-xs text-ink-muted">
              {categories.length} kategori. Pilih kode yang termasuk dalam setiap kategori, lalu hubungkan kategori ke tema.
            </p>
          </div>
          <Button size="sm" variant="primary" icon="plus" onClick={() => setCategoryDialog({})}>
            Kategori baru
          </Button>
        </div>

        {categories.length === 0 ? (
          <div className="p-4 sm:p-5">
            <EmptyState
              icon="layers"
              title="Belum ada kategori"
              description={
                codes.length === 0
                  ? 'Buat kode terlebih dahulu pada tab Coding, lalu kelompokkan kode tersebut ke dalam kategori.'
                  : 'Kelompokkan kode yang membahas gagasan serupa menjadi kategori. Kategori membantu merapikan tema.'
              }
              action={
                codes.length === 0 ? (
                  <Link to={`/p/${projectId}/analisis`}>
                    <Button variant="primary" icon="tag">
                      Buka tab Coding
                    </Button>
                  </Link>
                ) : (
                  <Button variant="primary" icon="plus" onClick={() => setCategoryDialog({})}>
                    Buat kategori pertama
                  </Button>
                )
              }
            />
          </div>
        ) : (
          <ul className="grid gap-3 p-4 sm:p-5 lg:grid-cols-2">
            {categories.map((category) => {
              const usage = categoryUsage(category.id)
              const linkedCodeIds = new Set(
                data.codeCategories.filter((link) => link.categoryId === category.id).map((link) => link.codeId),
              )
              return (
                <li key={category.id} className="rounded-[10px] border border-line px-3.5 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="text-[13px] font-semibold text-ink">{category.name}</h3>
                      {category.description ? <p className="mt-0.5 text-[11px] leading-relaxed text-ink-muted">{category.description}</p> : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-0.5">
                      <IconButton label={`Ubah kategori ${category.name}`} icon="edit" size="sm" onClick={() => setCategoryDialog({ category })} />
                      <IconButton label={`Hapus kategori ${category.name}`} icon="trash" size="sm" danger onClick={() => setDeletingCategory(category)} />
                    </div>
                  </div>
                  <p className="mt-2 text-[10px] text-ink-muted">
                    {usage.codes} kode terkait · {usage.themes} tema memakai kategori ini
                  </p>
                  {codes.length === 0 ? (
                    <p className="mt-2 rounded-md bg-surface-2/60 px-2.5 py-2 text-[11px] text-ink-muted">
                      Belum ada kode pada proyek ini.
                    </p>
                  ) : (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {codes.map((code) => {
                        const active = linkedCodeIds.has(code.id)
                        return (
                          <button
                            key={code.id}
                            type="button"
                            aria-pressed={active}
                            onClick={() => void toggleCodeCategory(projectId, code.id, category.id)}
                            className={cx(
                              'inline-flex min-h-8 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] transition-colors',
                              active ? 'border-primary bg-primary-soft font-medium text-primary' : 'border-line text-ink-muted hover:border-line-strong hover:text-ink',
                            )}
                          >
                            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: code.color }} aria-hidden="true" />
                            {code.name}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section className="rounded-[12px] border border-line bg-surface" aria-labelledby="tema-analisis">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-3.5 sm:px-5">
          <div>
            <h2 id="tema-analisis" className="text-[15px] font-semibold text-ink">
              Tema
            </h2>
            <p className="mt-0.5 text-xs text-ink-muted">
              {themes.length} tema. Setiap tema wajib memiliki bukti kutipan agar dapat ditelusuri ke jawaban asli.
            </p>
          </div>
          <Button size="sm" variant="primary" icon="plus" onClick={() => setThemeDialog({})}>
            Tema baru
          </Button>
        </div>

        {themes.length === 0 ? (
          <div className="p-4 sm:p-5">
            <EmptyState
              icon="analysis"
              title="Belum ada tema"
              description={
                categories.length === 0
                  ? 'Buat kategori dari kode terlebih dahulu. Tema dibangun dari pola lintas kategori dan bukti jawaban.'
                  : 'Rumuskan pola yang muncul dari kategori dan jawaban. Tambahkan bukti kutipan untuk setiap tema.'
              }
              action={
                categories.length === 0 ? (
                  <Button variant="primary" icon="plus" onClick={() => setCategoryDialog({})}>
                    Buat kategori
                  </Button>
                ) : (
                  <Button variant="primary" icon="plus" onClick={() => setThemeDialog({})}>
                    Buat tema pertama
                  </Button>
                )
              }
            />
          </div>
        ) : (
          <div className="space-y-3 p-4 sm:p-5">
            {themes.map((theme) => (
              <ThemeCard
                key={theme.id}
                projectId={projectId}
                theme={theme}
                categories={categories}
                onEdit={() => setThemeDialog({ theme })}
                onDelete={() => setDeletingTheme(theme)}
              />
            ))}
          </div>
        )}
      </section>

      <GeneralMemos projectId={projectId} />

      {categoryDialog ? (
        <CategoryDialog
          key={categoryDialog.category?.id ?? 'baru'}
          projectId={projectId}
          category={categoryDialog.category}
          onClose={() => setCategoryDialog(null)}
        />
      ) : null}
      {themeDialog ? (
        <ThemeDialog
          key={themeDialog.theme?.id ?? 'baru'}
          projectId={projectId}
          theme={themeDialog.theme}
          onClose={() => setThemeDialog(null)}
        />
      ) : null}

      <ConfirmDialog
        open={Boolean(deletingCategory)}
        onClose={() => setDeletingCategory(null)}
        onConfirm={() => void confirmDeleteCategory()}
        busy={busy}
        title={deletingCategory ? `Hapus kategori “${deletingCategory.name}”?` : 'Hapus kategori?'}
        description="Tindakan ini tidak dapat dibatalkan."
        impact={
          deletingCategory
            ? `${categoryUsage(deletingCategory.id).codes} hubungan kode dan ${categoryUsage(deletingCategory.id).themes} hubungan tema akan dilepas. Kode, tema, dan jawaban tetap tersimpan; hanya kategori ini yang dihapus.`
            : ''
        }
        confirmLabel="Hapus kategori"
      />

      <ConfirmDialog
        open={Boolean(deletingTheme)}
        onClose={() => setDeletingTheme(null)}
        onConfirm={() => void confirmDeleteTheme()}
        busy={busy}
        title={deletingTheme ? `Hapus tema “${deletingTheme.name}”?` : 'Hapus tema?'}
        description="Tindakan ini tidak dapat dibatalkan."
        impact={
          deletingTheme
            ? `${data.themeEvidence.filter((item) => item.themeId === deletingTheme.id).length} bukti dan ${data.themeCategories.filter((item) => item.themeId === deletingTheme.id).length} hubungan kategori akan dihapus. Memo tema menjadi memo umum. Kode, kategori, dan jawaban asli tetap tersimpan.`
            : ''
        }
        confirmLabel="Hapus tema"
      />
    </div>
  )
}
