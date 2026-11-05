import { useEffect, useMemo, useRef, useState } from 'react'
import type { ExtractionResult } from '../lib/import'
import { ACCEPTED_EXTENSIONS, MAX_FILE_BYTES, extractFile, parseQuestions } from '../lib/import'
import type { Project } from '../lib/types'
import { useWorkspace } from '../lib/store'
import { bytes, uid } from '../lib/utils'
import { Badge, Button, Checkbox, Field, IconButton, InlineNotice, Input, Modal, Spinner, Tabs, Textarea, cx, useToast } from './ui'
import { Icon } from './Icon'

/* ------------------------------------------------------------------ */
/* Sumber impor                                                        */
/* ------------------------------------------------------------------ */

export function ImportSourceDialog({
  open,
  onClose,
  onExtracted,
}: {
  open: boolean
  onClose: () => void
  onExtracted: (result: ExtractionResult) => void
}) {
  const [tab, setTab] = useState('unggah')
  const [busy, setBusy] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [processingName, setProcessingName] = useState('')
  const [pasteTitle, setPasteTitle] = useState('')
  const [pasteText, setPasteText] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const requestRef = useRef(0)

  useEffect(() => {
    if (!open) {
      // Invalidasi hasil ekstraksi yang masih berjalan agar tidak memanggil onExtracted
      // setelah dialog ditutup atau dibuka kembali.
      requestRef.current += 1
      return
    }
    requestRef.current += 1
    setTab('unggah')
    setBusy(false)
    setDragging(false)
    setError(null)
    setProcessingName('')
    setPasteTitle('')
    setPasteText('')
  }, [open])

  const handleFile = async (file: File | undefined) => {
    if (!file || busy) return
    const request = requestRef.current + 1
    requestRef.current = request
    setBusy(true)
    setError(null)
    setProcessingName(file.name)
    try {
      const result = await extractFile(file)
      if (requestRef.current !== request) return
      if (result.status === 'Berhasil') {
        onExtracted(result)
        onClose()
      } else {
        setError(result.error ?? 'Dokumen tidak dapat dibaca. Coba file lain atau tempel teksnya.')
      }
    } catch {
      if (requestRef.current === request) {
        setError('Terjadi kesalahan saat membaca file. Coba file lain atau tempel teksnya.')
      }
    } finally {
      if (requestRef.current === request) setBusy(false)
    }
  }

  const submitPaste = () => {
    const text = pasteText.trim()
    if (text.length < 20) {
      setError('Tempel teks minimal 20 karakter agar dapat dideteksi.')
      return
    }
    const title = pasteTitle.trim() || 'Teks tempel'
    const result: ExtractionResult = {
      text,
      fileName: title,
      fileType: 'text/plain',
      fileSize: new Blob([text]).size,
      status: 'Berhasil',
      error: null,
    }
    onExtracted(result)
    onClose()
  }

  const footer =
    tab === 'tempel' ? (
      <>
        <Button onClick={onClose}>Batal</Button>
        <Button variant="primary" onClick={submitPaste} disabled={pasteText.trim().length < 20}>
          Lanjutkan ke pratinjau
        </Button>
      </>
    ) : undefined

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Impor pertanyaan"
      description="Ekstraksi hanya membaca teks. Anda akan meninjau setiap kandidat sebelum menyimpannya."
      size="lg"
      preventClose={busy}
      footer={footer}
    >
      <div className="space-y-5">
        <Tabs
          label="Metode impor"
          value={tab}
          onChange={(next) => {
            setTab(next)
            setError(null)
          }}
          items={[
            { id: 'unggah', label: 'Unggah dokumen' },
            { id: 'tempel', label: 'Tempel teks' },
          ]}
        />

        {tab === 'unggah' ? (
          <div className="space-y-4">
            {busy ? (
              <div className="flex items-center gap-3 rounded-[10px] border border-line bg-surface-2/60 px-4 py-5" aria-live="polite">
                <Spinner size={20} className="text-primary" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">Membaca {processingName}</p>
                  <p className="mt-0.5 text-xs text-ink-muted">Mengekstrak teks dan mendeteksi kandidat pertanyaan…</p>
                </div>
              </div>
            ) : (
              <label
                onDragOver={(event) => {
                  event.preventDefault()
                  setDragging(true)
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(event) => {
                  event.preventDefault()
                  setDragging(false)
                  void handleFile(event.dataTransfer.files?.[0])
                }}
                className={cx(
                  'flex cursor-pointer flex-col items-center justify-center rounded-[12px] border border-dashed px-5 py-10 text-center transition-colors duration-150',
                  dragging ? 'border-primary bg-primary-soft/60' : 'border-line-strong bg-surface-2/40 hover:border-primary hover:bg-primary-soft/30',
                )}
              >
                <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-surface text-primary shadow-sm">
                  <Icon name="upload" size={20} />
                </span>
                <span className="text-sm font-medium text-ink">Tarik file ke sini atau pilih dokumen</span>
                <span className="mt-1 text-xs leading-relaxed text-ink-muted">DOCX, PDF, atau TXT. Maksimal 10 MB per file.</span>
                <span className="mt-4 inline-flex h-9 items-center rounded-[8px] border border-line-strong bg-surface px-3 text-[13px] font-medium text-ink">
                  Pilih file
                </span>
                <input
                  ref={inputRef}
                  type="file"
                  accept={ACCEPTED_EXTENSIONS.join(',')}
                  className="sr-only"
                  onChange={(event) => {
                    void handleFile(event.target.files?.[0])
                    event.target.value = ''
                  }}
                />
              </label>
            )}

            {error ? (
              <InlineNotice tone="danger" title="Dokumen tidak dapat dibaca">
                <p>{error}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" icon="refresh" onClick={() => inputRef.current?.click()}>
                    Coba file lain
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { setTab('tempel'); setError(null) }}>
                    Tempel teks
                  </Button>
                </div>
              </InlineNotice>
            ) : (
              <p className="text-xs leading-relaxed text-ink-muted">
                Batas ukuran {bytes(MAX_FILE_BYTES)}. PDF hasil pindai biasanya tidak memiliki lapisan teks. Jika teks
                tidak terbaca, gunakan tab Tempel teks atau masukkan pertanyaan secara manual.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <Field label="Nama sumber" htmlFor="paste-source" optional hint="Ditampilkan pada daftar dokumen sumber.">
              <Input
                id="paste-source"
                value={pasteTitle}
                onChange={(event) => setPasteTitle(event.target.value)}
                placeholder="Contoh: Panduan wawancara awal"
                maxLength={120}
              />
            </Field>
            <Field
              label="Teks dokumen"
              htmlFor="paste-text"
              required
              hint={`${pasteText.length.toLocaleString('id-ID')} karakter. Pertahankan penomoran dan judul bagian agar urutan terdeteksi.`}
            >
              <Textarea
                id="paste-text"
                value={pasteText}
                onChange={(event) => {
                  setPasteText(event.target.value)
                  if (error) setError(null)
                }}
                placeholder={'Bagian 1: Latar belakang\n1. Bagaimana Anda mengatur waktu belajar?\n2. Apa yang memicu Anda untuk mulai belajar?'}
                className="min-h-56 font-mono text-[13px] leading-relaxed"
              />
            </Field>
            {error ? <InlineNotice tone="danger">{error}</InlineNotice> : null}
          </div>
        )}
      </div>
    </Modal>
  )
}

/* ------------------------------------------------------------------ */
/* Pratinjau hasil ekstraksi                                           */
/* ------------------------------------------------------------------ */

interface ReviewItem {
  key: string
  text: string
  section: string
  include: boolean
  confidence: 'tinggi' | 'sedang' | 'rendah'
}

const CONFIDENCE_LABEL: Record<ReviewItem['confidence'], { label: string; tone: 'success' | 'warn' | 'neutral' }> = {
  tinggi: { label: 'Jelas', tone: 'success' },
  sedang: { label: 'Periksa', tone: 'warn' },
  rendah: { label: 'Kandidat lemah', tone: 'neutral' },
}

function normalize(text: string): string {
  return text.replace(/\s+/g, ' ').trim().toLowerCase()
}

export function ImportReviewDialog({
  open,
  onClose,
  project,
  text,
  fileName,
  sourceDocumentId,
  onManual,
}: {
  open: boolean
  onClose: () => void
  project: Project
  text: string
  fileName: string
  sourceDocumentId: string | null
  onManual?: () => void
}) {
  const { data, bulkCreateQuestions } = useWorkspace()
  const { notify } = useToast()
  const [items, setItems] = useState<ReviewItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const existingTexts = useMemo(() => {
    return new Set(
      data.questions.filter((question) => question.projectId === project.id).map((question) => normalize(question.text)),
    )
  }, [data.questions, project.id])

  const sectionOptions = useMemo(() => {
    return data.sections
      .filter((section) => section.projectId === project.id)
      .sort((a, b) => a.orderIndex - b.orderIndex)
      .map((section) => section.title)
  }, [data.sections, project.id])

  useEffect(() => {
    if (!open) return
    const parsed = parseQuestions(text)
    setItems(
      parsed.map((candidate) => ({
        key: candidate.id,
        text: candidate.text,
        section: candidate.sectionTitle ?? '',
        include: candidate.confidence !== 'rendah' && !existingTexts.has(normalize(candidate.text)),
        confidence: candidate.confidence,
      })),
    )
    setError(null)
    setBusy(false)
  }, [open, text, existingTexts])

  const includedCount = items.filter((item) => item.include).length
  const isExisting = (value: string) => existingTexts.has(normalize(value))

  const update = (key: string, patch: Partial<ReviewItem>) => {
    setItems((prev) => prev.map((item) => (item.key === key ? { ...item, ...patch } : item)))
    if (error) setError(null)
  }

  const move = (index: number, direction: -1 | 1) => {
    setItems((prev) => {
      const target = index + direction
      if (target < 0 || target >= prev.length) return prev
      const next = [...prev]
      const [row] = next.splice(index, 1)
      next.splice(target, 0, row)
      return next
    })
  }

  const remove = (key: string) => {
    setItems((prev) => prev.filter((item) => item.key !== key))
  }

  const addRow = () => {
    setItems((prev) => [
      ...prev,
      {
        key: uid('rev'),
        text: '',
        section: prev[prev.length - 1]?.section ?? '',
        include: true,
        confidence: 'sedang',
      },
    ])
  }

  const save = async () => {
    const selected = items.filter((item) => item.include)
    if (selected.length === 0) {
      setError('Pilih minimal satu pertanyaan untuk ditambahkan ke panduan.')
      return
    }
    const empty = selected.find((item) => item.text.trim().length === 0)
    if (empty) {
      setError('Ada pertanyaan terpilih yang masih kosong. Isi teksnya atau hapus dari pilihan.')
      return
    }
    const seen = new Set<string>()
    for (const item of selected) {
      const key = normalize(item.text)
      if (seen.has(key)) {
        setError(`Pertanyaan “${item.text.trim()}” muncul lebih dari sekali pada pilihan. Hapus salah satunya.`)
        return
      }
      if (existingTexts.has(key)) {
        setError(`Pertanyaan “${item.text.trim()}” sudah ada di panduan proyek ini.`)
        return
      }
      seen.add(key)
    }

    setBusy(true)
    try {
      const count = await bulkCreateQuestions(
        project.id,
        selected.map((item) => ({
          text: item.text.trim(),
          guidance: '',
          sectionTitle: item.section.trim() || null,
          isRequired: true,
        })),
        sourceDocumentId,
      )
      if (count === 0) {
        setError('Tidak ada pertanyaan yang dapat disimpan. Periksa kembali pilihan Anda.')
        return
      }
      notify(`${count} pertanyaan ditambahkan ke panduan.`)
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Tinjau hasil ekstraksi"
      description={`Sumber: ${fileName}. Periksa teks, bagian, dan urutan sebelum disimpan.`}
      size="xl"
      preventClose={busy}
      footer={
        <>
          <p className="mr-auto text-xs text-ink-muted">
            <span className="font-semibold text-ink">{includedCount}</span> dari {items.length} kandidat dipilih
          </p>
          <Button onClick={onClose} disabled={busy}>
            Batal
          </Button>
          <Button variant="primary" onClick={() => void save()} disabled={busy || items.length === 0}>
            {busy ? 'Menyimpan…' : `Tambahkan ${includedCount} pertanyaan`}
          </Button>
        </>
      }
    >
      {items.length === 0 ? (
        <div className="rounded-[10px] border border-dashed border-line-strong bg-surface-2/50 px-5 py-10 text-center">
          <span className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-surface text-ink-muted">
            <Icon name="search" size={18} />
          </span>
          <p className="text-sm font-medium text-ink">Tidak ada kandidat pertanyaan yang terdeteksi</p>
          <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-ink-muted">
            Dokumen mungkin tidak memuat daftar pertanyaan, atau formatnya tidak dikenali. Anda tetap dapat menulis
            pertanyaan secara manual.
          </p>
          {onManual ? (
            <Button className="mt-4" variant="primary" size="sm" icon="plus" onClick={onManual}>
              Tambah pertanyaan manual
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="secondary" onClick={() => setItems((prev) => prev.map((item) => ({ ...item, include: true })))}>
              Pilih semua
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setItems((prev) => prev.map((item) => ({ ...item, include: false })))}>
              Kosongkan pilihan
            </Button>
            <Button size="sm" variant="ghost" icon="plus" onClick={addRow} className="ml-auto">
              Tambah baris
            </Button>
          </div>

          <div className="space-y-2">
            {items.map((item, index) => {
              const duplicate = item.include && isExisting(item.text)
              const confidence = CONFIDENCE_LABEL[item.confidence]
              return (
                <div
                  key={item.key}
                  className={cx(
                    'rounded-[10px] border px-3 py-3 transition-colors sm:px-4',
                    item.include ? 'border-line bg-surface' : 'border-line/70 bg-surface-2/40',
                  )}
                >
                  <div className="flex items-start gap-3">
                    <span className="mono-meta mt-2.5 w-6 shrink-0 text-ink-muted">{String(index + 1).padStart(2, '0')}</span>
                    <div className="min-w-0 flex-1 space-y-2">
                      <label className="block">
                        <span className="sr-only">Teks pertanyaan {index + 1}</span>
                        <Textarea
                          value={item.text}
                          onChange={(event) => update(item.key, { text: event.target.value })}
                          className="min-h-[52px] py-2 text-sm leading-snug"
                          rows={2}
                          disabled={!item.include}
                          invalid={duplicate}
                        />
                      </label>
                      <div className="flex flex-wrap items-center gap-2">
                        <label className="flex min-w-0 flex-1 items-center gap-1.5 sm:max-w-xs">
                          <span className="mono-meta shrink-0 text-ink-muted">Bagian</span>
                          <Input
                            value={item.section}
                            onChange={(event) => update(item.key, { section: event.target.value })}
                            list={`sections-${project.id}`}
                            placeholder="Tanpa bagian"
                            className="h-9 text-xs"
                            disabled={!item.include}
                          />
                        </label>
                        <Badge tone={confidence.tone}>{confidence.label}</Badge>
                        {duplicate ? <Badge tone="danger">Sudah ada di panduan</Badge> : null}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-center gap-1 sm:flex-row">
                      <Checkbox
                        label={<span className="sr-only">Sertakan pertanyaan {index + 1}</span>}
                        checked={item.include}
                        onChange={(event) => update(item.key, { include: event.target.checked })}
                        className="mt-1"
                      />
                      <IconButton label="Naikkan" icon="chevronLeft" size="sm" className="rotate-90" onClick={() => move(index, -1)} disabled={index === 0} />
                      <IconButton
                        label="Turunkan"
                        icon="chevronRight"
                        size="sm"
                        className="rotate-90"
                        onClick={() => move(index, 1)}
                        disabled={index === items.length - 1}
                      />
                      <IconButton label="Hapus baris" icon="trash" size="sm" danger onClick={() => remove(item.key)} />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          <datalist id={`sections-${project.id}`}>
            {sectionOptions.map((title) => (
              <option key={title} value={title} />
            ))}
          </datalist>

          {error ? <InlineNotice tone="danger">{error}</InlineNotice> : null}
          <p className="text-xs leading-relaxed text-ink-muted">
            Pertanyaan yang sudah ada di panduan dinonaktifkan otomatis agar tidak tercatat dua kali. Baris tanpa teks
            tidak dapat disimpan.
          </p>
        </div>
      )}
    </Modal>
  )
}
