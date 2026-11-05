import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useProject, usePageTitle } from '../lib/hooks'
import { useWorkspace } from '../lib/store'
import type { SourceDocument } from '../lib/types'
import { documentFromExtraction } from '../lib/import'
import type { ExtractionResult } from '../lib/import'
import { bytes, formatDate, relativeTime, truncate } from '../lib/utils'
import { ImportReviewDialog, ImportSourceDialog } from '../components/ImportDialog'
import { Icon } from '../components/Icon'
import {
  Badge,
  Button,
  ConfirmDialog,
  Drawer,
  EmptyState,
  IconButton,
  InlineNotice,
  PageHeader,
  SearchInput,
  Select,
  StatusBadge,
  useToast,
} from '../components/ui'

interface PendingReview {
  text: string
  fileName: string
  sourceDocumentId: string
}

const TYPE_LABEL: Record<string, string> = {
  '.docx': 'DOCX',
  '.pdf': 'PDF',
  '.txt': 'TXT',
  'text/plain': 'Teks',
}

function fileTypeLabel(doc: SourceDocument): string {
  const found = Object.keys(TYPE_LABEL).find((key) => doc.fileType.toLowerCase().includes(key))
  if (found) return TYPE_LABEL[found]
  if (doc.fileType.includes('word')) return 'DOCX'
  if (doc.fileType.includes('pdf')) return 'PDF'
  if (doc.fileName.toLowerCase().endsWith('.docx')) return 'DOCX'
  if (doc.fileName.toLowerCase().endsWith('.pdf')) return 'PDF'
  return 'TXT'
}

export function Documents() {
  const project = useProject()
  const { data, addDocument, deleteDocument } = useWorkspace()
  const { notify } = useToast()
  const navigate = useNavigate()
  usePageTitle('Dokumen sumber')

  const [importOpen, setImportOpen] = useState(false)
  const [review, setReview] = useState<PendingReview | null>(null)
  const [viewing, setViewing] = useState<SourceDocument | null>(null)
  const [deleting, setDeleting] = useState<SourceDocument | null>(null)
  const [busy, setBusy] = useState(false)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('Semua')

  const documents = useMemo(() => {
    if (!project) return []
    return data.documents
      .filter((doc) => doc.projectId === project.id)
      .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())
  }, [data.documents, project])

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return documents.filter((doc) => {
      if (statusFilter !== 'Semua' && doc.extractionStatus !== statusFilter) return false
      if (!needle) return true
      return doc.fileName.toLowerCase().includes(needle) || doc.textPreview.toLowerCase().includes(needle)
    })
  }, [documents, query, statusFilter])

  if (!project) return null

  const questionCount = (docId: string) =>
    data.questions.filter((question) => question.sourceDocumentId === docId).length

  const linkedQuestions = deleting ? questionCount(deleting.id) : 0

  const handleExtracted = async (result: ExtractionResult) => {
    const doc = documentFromExtraction(project.id, result)
    await addDocument(doc)
    setReview({ text: result.text, fileName: result.fileName, sourceDocumentId: doc.id })
    notify('Dokumen tersimpan. Tinjau kandidat pertanyaan sebelum menambahkan ke panduan.')
  }

  const confirmDelete = async () => {
    if (!deleting) return
    setBusy(true)
    try {
      await deleteDocument(deleting.id)
      notify('Dokumen sumber dihapus. Pertanyaan yang sudah dikonfirmasi tetap tersimpan.')
      setDeleting(null)
      setViewing(null)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Dokumen sumber"
        description="Simpan dokumen panduan asli secara terpisah dari pertanyaan yang sudah dikonfirmasi. Ekstraksi teks tidak mengubah dokumen sumber."
        meta={
          <>
            <Badge tone="neutral">{documents.length} dokumen</Badge>
            <span className="text-ink-muted">DOCX, PDF, TXT, atau teks tempel</span>
          </>
        }
        actions={
          <Button variant="primary" icon="upload" onClick={() => setImportOpen(true)}>
            Tambah dokumen
          </Button>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
        <div className="min-w-0">
          <section className="rounded-[12px] border border-line bg-surface">
            <div className="flex flex-col gap-3 border-b border-line px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <div className="flex items-center gap-2">
                <h2 className="text-[15px] font-semibold text-ink">Daftar dokumen</h2>
                <span className="mono-meta text-ink-muted">{filtered.length}</span>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <SearchInput
                  value={query}
                  onChange={setQuery}
                  placeholder="Cari nama atau isi…"
                  className="sm:w-56"
                />
                <Select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  aria-label="Filter status ekstraksi"
                  className="text-[13px] sm:w-40"
                >
                  <option value="Semua">Semua status</option>
                  <option value="Berhasil">Berhasil</option>
                  <option value="Tidak terbaca">Tidak terbaca</option>
                  <option value="Gagal">Gagal</option>
                </Select>
              </div>
            </div>

            {documents.length === 0 ? (
              <div className="p-4 sm:p-5">
                <EmptyState
                  icon="document"
                  title="Belum ada dokumen sumber"
                  description="Unggah panduan wawancara dalam format DOCX, PDF, atau TXT. Anda juga dapat menempel teks. Dokumen asli disimpan terpisah dari pertanyaan yang nanti dikonfirmasi."
                  action={
                    <Button variant="primary" icon="upload" onClick={() => setImportOpen(true)}>
                      Unggah dokumen pertama
                    </Button>
                  }
                />
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-4 sm:p-5">
                <EmptyState
                  icon="search"
                  title="Tidak ada dokumen yang cocok"
                  description="Ubah kata kunci atau filter status untuk menemukan dokumen lain."
                  action={
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setQuery('')
                        setStatusFilter('Semua')
                      }}
                    >
                      Reset filter
                    </Button>
                  }
                />
              </div>
            ) : (
              <ul className="divide-y divide-line">
                {filtered.map((doc) => {
                  const linked = questionCount(doc.id)
                  const canReview = Boolean(doc.extractedText) && doc.extractionStatus === 'Berhasil'
                  return (
                    <li key={doc.id} className="px-4 py-4 sm:px-5">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[9px] border border-line bg-surface-2 text-ink-soft">
                          <Icon name="document" size={18} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="min-w-0 break-words text-[14px] font-semibold text-ink">{doc.fileName}</p>
                            <Badge tone="neutral">{fileTypeLabel(doc)}</Badge>
                            <StatusBadge status={doc.extractionStatus} />
                          </div>
                          <p className="mt-1 text-[11px] text-ink-muted">
                            {bytes(doc.fileSize)} · {doc.charCount.toLocaleString('id-ID')} karakter · diunggah{' '}
                            {formatDate(doc.uploadedAt)} ({relativeTime(doc.uploadedAt)})
                          </p>
                          {doc.textPreview ? (
                            <p className="mt-2 line-clamp-2 text-[13px] leading-relaxed text-ink-soft">{truncate(doc.textPreview, 220)}</p>
                          ) : (
                            <p className="mt-2 text-[13px] italic text-ink-muted">Pratinjau teks tidak tersedia.</p>
                          )}
                          {doc.extractionError ? (
                            <p className="mt-2 rounded-md bg-danger-soft px-2.5 py-1.5 text-xs leading-relaxed text-danger">{doc.extractionError}</p>
                          ) : null}
                          {doc.truncated ? (
                            <p className="mt-2 rounded-md bg-warn-soft px-2.5 py-1.5 text-xs leading-relaxed text-warn">
                              Teks dokumen lebih dari 400.000 karakter. Hanya bagian awal yang disimpan; pertanyaan
                              tetap dapat ditambahkan secara manual.
                            </p>
                          ) : null}
                          <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
                            <span className="text-ink-muted">
                              {linked > 0 ? `${linked} pertanyaan tertaut` : 'Belum ada pertanyaan tertaut'}
                            </span>
                            {canReview ? (
                              <span className="text-ink-muted">Teks tersimpan untuk impor ulang</span>
                            ) : (
                              <span className="text-warn">Teks tidak tersedia untuk impor ulang</span>
                            )}
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-1 self-start">
                          {canReview ? (
                            <Button
                              size="sm"
                              variant="secondary"
                              icon="plus"
                              onClick={() =>
                                setReview({
                                  text: doc.extractedText ?? '',
                                  fileName: doc.fileName,
                                  sourceDocumentId: doc.id,
                                })
                              }
                            >
                              Impor pertanyaan
                            </Button>
                          ) : null}
                          <IconButton label="Tinjau teks dokumen" icon="search" size="sm" onClick={() => setViewing(doc)} />
                          <IconButton label="Hapus dokumen" icon="trash" size="sm" danger onClick={() => setDeleting(doc)} />
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          <section className="mt-4 rounded-[12px] border border-line bg-surface-2/40 px-4 py-3.5 sm:px-5">
            <p className="mono-meta uppercase text-ink-muted">Cara kerja impor</p>
            <ol className="mt-2 grid gap-2 text-[13px] leading-relaxed text-ink-soft sm:grid-cols-3">
              <li className="flex gap-2">
                <span className="mono-meta shrink-0 text-accent">01</span>
                Ekstraksi hanya membaca teks. Gambar dan hasil pindai tidak dikenali.
              </li>
              <li className="flex gap-2">
                <span className="mono-meta shrink-0 text-accent">02</span>
                Setiap kandidat pertanyaan ditinjau, bisa diedit atau dibuang.
              </li>
              <li className="flex gap-2">
                <span className="mono-meta shrink-0 text-accent">03</span>
                Setelah disimpan, pertanyaan masuk ke panduan dan dokumen asli tetap utuh.
              </li>
            </ol>
          </section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20">
          <section className="rounded-[12px] border border-line bg-surface px-4 py-4">
            <h2 className="text-[13px] font-semibold text-ink">Ringkasan dokumen</h2>
            <dl className="mt-2.5 space-y-2 text-[12px]">
              <div className="flex items-center justify-between gap-2">
                <dt className="text-ink-muted">Total dokumen</dt>
                <dd className="font-medium text-ink">{documents.length}</dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-ink-muted">Berhasil diekstrak</dt>
                <dd className="font-medium text-ink">{documents.filter((doc) => doc.extractionStatus === 'Berhasil').length}</dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-ink-muted">Perlu diperiksa</dt>
                <dd className="font-medium text-ink">{documents.filter((doc) => doc.extractionStatus !== 'Berhasil').length}</dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-ink-muted">Pertanyaan tertaut</dt>
                <dd className="font-medium text-ink">
                  {data.questions.filter((question) => question.projectId === project.id && question.sourceDocumentId).length}
                </dd>
              </div>
            </dl>
          </section>

          <section className="rounded-[12px] border border-line bg-surface px-4 py-4">
            <h2 className="text-[13px] font-semibold text-ink">Menulis manual</h2>
            <p className="mt-1 text-xs leading-relaxed text-ink-muted">
              Tidak punya dokumen? Anda dapat menulis pertanyaan langsung di panduan tanpa mengunggah apa pun.
            </p>
            <Button className="mt-3 w-full" variant="secondary" icon="guide" onClick={() => navigate(`/p/${project.id}/panduan?tambah=1`)}>
              Buka panduan
            </Button>
          </section>

          <InlineNotice tone="info" title="Data tetap di perangkat">
            File tidak diunggah ke server. Teks hasil ekstraksi disimpan di IndexedDB browser ini dan dapat dihapus kapan saja.
          </InlineNotice>
        </aside>
      </div>

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
            navigate(`/p/${project.id}/panduan?tambah=1`)
          }}
        />
      ) : null}

      <Drawer
        open={Boolean(viewing)}
        onClose={() => setViewing(null)}
        title={viewing?.fileName ?? 'Teks dokumen'}
        description={viewing ? `${fileTypeLabel(viewing)} · ${viewing.charCount.toLocaleString('id-ID')} karakter` : undefined}
        width="lg"
        footer={
          viewing?.extractedText && viewing.extractionStatus === 'Berhasil' ? (
            <>
              <Button onClick={() => setViewing(null)}>Tutup</Button>
              <Button
                variant="primary"
                icon="plus"
                onClick={() => {
                  setReview({
                    text: viewing.extractedText ?? '',
                    fileName: viewing.fileName,
                    sourceDocumentId: viewing.id,
                  })
                  setViewing(null)
                }}
              >
                Impor pertanyaan
              </Button>
            </>
          ) : (
            <Button onClick={() => setViewing(null)}>Tutup</Button>
          )
        }
      >
        {viewing ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={viewing.extractionStatus} />
              <Badge tone="neutral">{fileTypeLabel(viewing)}</Badge>
              <span className="mono-meta text-ink-muted">Diunggah {formatDate(viewing.uploadedAt)}</span>
            </div>
            {viewing.extractionError ? <InlineNotice tone="danger">{viewing.extractionError}</InlineNotice> : null}
            {viewing.truncated ? (
              <InlineNotice tone="warn" title="Teks dipotong">
                Dokumen melebihi 400.000 karakter. Hanya bagian awal yang disimpan untuk pratinjau dan impor ulang.
              </InlineNotice>
            ) : null}
            {viewing.extractedText ? (
              <>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[13px] font-medium text-ink">Teks hasil ekstraksi</p>
                  <span className="mono-meta text-ink-muted">{viewing.extractedText.length.toLocaleString('id-ID')} karakter</span>
                </div>
                <pre className="max-h-[55vh] overflow-auto whitespace-pre-wrap break-words rounded-[10px] border border-line bg-surface-2/50 p-3 font-mono text-[12px] leading-relaxed text-ink-soft">
                  {viewing.extractedText}
                </pre>
                <p className="text-xs leading-relaxed text-ink-muted">
                  Teks ini adalah hasil pembacaan otomatis dan bisa berbeda dari tata letak asli. Periksa kembali sebelum
                  menambahkan pertanyaan.
                </p>
              </>
            ) : (
              <InlineNotice tone="warn" title="Teks tidak tersimpan">
                Dokumen ini tidak memiliki teks hasil ekstraksi. Unggah ulang file asli atau tempel teksnya untuk membuat
                pertanyaan.
              </InlineNotice>
            )}
          </div>
        ) : null}
      </Drawer>

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={() => void confirmDelete()}
        busy={busy}
        title={deleting ? `Hapus “${deleting.fileName}”?` : 'Hapus dokumen?'}
        description="Dokumen sumber akan dihapus dari proyek ini."
        impact={
          linkedQuestions > 0
            ? `${linkedQuestions} pertanyaan tetap tersimpan di panduan, tetapi tautan ke dokumen sumber ini akan dilepas. Tindakan ini tidak dapat dibatalkan.`
            : 'Dokumen ini tidak tertaut ke pertanyaan mana pun. Tindakan ini tidak dapat dibatalkan.'
        }
        confirmLabel="Hapus dokumen"
      />
    </>
  )
}
