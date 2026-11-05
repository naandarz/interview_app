import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { usePageTitle, useProject } from '../lib/hooks'
import { useWorkspace } from '../lib/store'
import { projectRespondents, projectSessions } from '../lib/selectors'
import {
  EXPORT_TYPES,
  allowedFormats,
  buildExport,
  exportPreviewText,
  generateExportFile,
  scopeLabel,
  type ExportFormat,
  type ExportOptions,
  type ExportScope,
  type ExportType,
} from '../lib/exporters'
import type { ExportRecord } from '../lib/types'
import { downloadBlob, formatDate, nowIso, uid } from '../lib/utils'
import { Icon, type IconName } from '../components/Icon'
import {
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  IconButton,
  InlineNotice,
  PageHeader,
  Select,
  Spinner,
  Switch,
  cx,
  useToast,
} from '../components/ui'

const TYPE_ICONS: Record<ExportType, IconName> = {
  panduan: 'guide',
  'per-narasumber': 'people',
  'per-pertanyaan': 'note',
  'data-mentah': 'data',
  coding: 'tag',
  analisis: 'layers',
  laporan: 'analysis',
}

function typeDefinition(value: string) {
  return EXPORT_TYPES.find((item) => item.id === value || item.label === value)
}

export function ExportPage() {
  const project = useProject()
  const { data, addExportRecord, deleteExportRecord } = useWorkspace()
  const { notify } = useToast()

  usePageTitle(project ? `Ekspor · ${project.title}` : 'Ekspor')

  const [type, setType] = useState<ExportType>('panduan')
  const [format, setFormat] = useState<ExportFormat>('docx')
  const [scope, setScope] = useState<ExportScope>('project')
  const [scopeId, setScopeId] = useState<string | null>(null)
  const [anonymize, setAnonymize] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<ExportRecord | null>(null)
  const [deletingBusy, setDeletingBusy] = useState(false)

  const respondents = useMemo(() => (project ? projectRespondents(data, project.id) : []), [data, project])
  const sessions = useMemo(() => (project ? projectSessions(data, project.id) : []), [data, project])

  const formats = allowedFormats(type)
  const formatValid = formats.includes(format)
  const scopeChoices = useMemo(
    () => (scope === 'respondent' ? respondents : scope === 'session' ? sessions : []),
    [scope, respondents, sessions],
  )
  const scopeValid = scope === 'project' || scopeChoices.some((item) => item.id === scopeId)

  useEffect(() => {
    const nextFormats = allowedFormats(type)
    if (!nextFormats.includes(format)) setFormat(nextFormats[0])
  }, [type, format])

  useEffect(() => {
    if (scope === 'project') {
      if (scopeId !== null) setScopeId(null)
      return
    }
    if (!scopeChoices.some((item) => item.id === scopeId)) {
      setScopeId(scopeChoices[0]?.id ?? null)
    }
  }, [scope, scopeChoices, scopeId])

  const options = useMemo<ExportOptions>(
    () => ({
      type,
      format,
      scope,
      scopeId: scope === 'project' ? null : scopeId,
      anonymize,
    }),
    [type, format, scope, scopeId, anonymize],
  )

  const preview = useMemo(() => {
    if (!project || !scopeValid) return null
    try {
      return buildExport(data, project, options)
    } catch {
      return null
    }
  }, [data, project, options, scopeValid])

  const previewText = preview ? exportPreviewText(preview) : ''
  const previewLineCount = previewText ? previewText.split('\n').length : 0

  const history = useMemo(
    () =>
      project
        ? data.exports
            .filter((record) => record.projectId === project.id)
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        : [],
    [data.exports, project],
  )

  if (!project) {
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

  const handleScope = (next: ExportScope) => {
    setScope(next)
    setError(null)
    if (next === 'project') setScopeId(null)
    else if (next === 'respondent') setScopeId(respondents[0]?.id ?? null)
    else setScopeId(sessions[0]?.id ?? null)
  }

  const handleGenerate = async () => {
    if (!project || !preview || !formatValid || !scopeValid) return
    setBusy(true)
    setError(null)
    try {
      const { document, blob } = await generateExportFile(data, project, options)
      downloadBlob(blob, document.fileName)
      await addExportRecord({
        id: uid('exp'),
        projectId: project.id,
        type,
        format,
        scopeLabel: scopeLabel(options, data),
        anonymized: anonymize,
        fileName: document.fileName,
        createdAt: nowIso(),
      })
      notify(`File ${document.fileName} berhasil dibuat.`)
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'File ekspor tidak dapat dibuat.'
      setError(message)
      notify('Ekspor gagal dibuat. Periksa pilihan lalu coba lagi.', 'error')
    } finally {
      setBusy(false)
    }
  }

  const handleCopy = async () => {
    if (!previewText) return
    try {
      await navigator.clipboard.writeText(previewText)
      notify('Teks pratinjau disalin ke papan klip.')
    } catch {
      notify('Teks tidak dapat disalin. Pilih teks pratinjau secara manual.', 'error')
    }
  }

  const handleReuse = (record: ExportRecord) => {
    const definition = typeDefinition(record.type)
    if (!definition) {
      notify('Jenis ekspor pada riwayat ini tidak dikenali.', 'error')
      return
    }
    setType(definition.id)
    const recordFormat = record.format.toLowerCase()
    const nextFormats = allowedFormats(definition.id)
    if (nextFormats.includes(recordFormat as ExportFormat)) setFormat(recordFormat as ExportFormat)
    setAnonymize(record.anonymized)
    setScope('project')
    setScopeId(null)
    setError(null)
    document.getElementById('ekspor-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    notify('Jenis, format, dan opsi anonim disalin. Cakupan diatur ke seluruh proyek, periksa sebelum membuat file.', 'info')
  }

  const confirmDelete = async () => {
    if (!deleting) return
    setDeletingBusy(true)
    try {
      await deleteExportRecord(deleting.id)
      notify('Catatan riwayat ekspor dihapus. File yang sudah diunduh tidak terpengaruh.')
      setDeleting(null)
    } finally {
      setDeletingBusy(false)
    }
  }

  const selectedType = EXPORT_TYPES.find((item) => item.id === type)
  const csvRestricted = !formats.includes('csv')
  const csvEmpty = Boolean(preview && preview.csv && preview.csv.rows.length === 0)

  const scopeField = (() => {
    if (scope === 'project') {
      return <p className="text-xs leading-relaxed text-ink-muted">Seluruh narasumber dan sesi aktif pada proyek ini.</p>
    }
    if (scopeChoices.length === 0) {
      return (
        <InlineNotice tone="warn" title={scope === 'respondent' ? 'Belum ada narasumber aktif' : 'Belum ada sesi aktif'}>
          {scope === 'respondent'
            ? 'Tambahkan narasumber sebelum mengekspor per narasumber.'
            : 'Buat sesi wawancara sebelum mengekspor per sesi.'}{' '}
          <Link
            to={`/p/${project.id}/${scope === 'respondent' ? 'narasumber' : 'sesi'}`}
            className="font-medium text-primary underline underline-offset-2"
          >
            Buka halaman
          </Link>
        </InlineNotice>
      )
    }
    return (
      <Select
        id="ekspor-cakupan-id"
        value={scopeId ?? ''}
        onChange={(event) => setScopeId(event.target.value)}
        aria-label={scope === 'respondent' ? 'Pilih narasumber' : 'Pilih sesi'}
      >
        {scope === 'respondent'
          ? respondents.map((respondent) => (
              <option key={respondent.id} value={respondent.id}>
                {respondent.code}
                {respondent.displayName ? ` · ${respondent.displayName}` : ''}
              </option>
            ))
          : sessions.map((session) => {
              const respondent = data.respondents.find((item) => item.id === session.respondentId)
              return (
                <option key={session.id} value={session.id}>
                  {respondent?.code ?? 'Narasumber'} · {session.title} · {formatDate(session.interviewDate)}
                </option>
              )
            })}
      </Select>
    )
  })()

  return (
    <>
      <PageHeader
        breadcrumb={
          <>
            <Link to={`/p/${project.id}`} className="hover:text-ink">
              {project.title}
            </Link>
            <Icon name="chevronRight" size={12} />
            <span>Ekspor</span>
          </>
        }
        title="Ekspor hasil wawancara"
        description="Pilih jenis data, format, dan cakupan. Pratinjau di bawah mengikuti data yang tersimpan saat ini."
        meta={
          <>
            <Badge tone="neutral">{respondents.length} narasumber aktif</Badge>
            <Badge tone="neutral">{sessions.length} sesi aktif</Badge>
            <Badge tone="neutral">{history.length} riwayat ekspor</Badge>
          </>
        }
        actions={
          <Button
            variant="primary"
            icon={busy ? undefined : 'download'}
            onClick={() => void handleGenerate()}
            disabled={busy || !preview || !scopeValid || !formatValid}
          >
            {busy ? <Spinner size={15} /> : null}
            {busy ? 'Membuat file…' : 'Buat dan unduh'}
          </Button>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px] xl:items-start">
        <div className="min-w-0 space-y-5">
          <section id="ekspor-form" className="rounded-[12px] border border-line bg-surface px-4 py-4 sm:px-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="text-[15px] font-semibold text-ink">1. Pilih jenis ekspor</h2>
                <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">
                  {selectedType?.description ?? 'Pilih isi file yang ingin dibuat.'}
                </p>
              </div>
              <Badge tone="neutral">{selectedType?.label}</Badge>
            </div>

            <div role="radiogroup" aria-label="Jenis ekspor" className="mt-3 grid gap-2 sm:grid-cols-2">
              {EXPORT_TYPES.map((item) => {
                const active = item.id === type
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => {
                      setType(item.id)
                      setError(null)
                    }}
                    className={cx(
                      'flex items-start gap-2.5 rounded-[9px] border px-3 py-2.5 text-left transition-[border-color,background-color] duration-150',
                      active
                        ? 'border-primary bg-primary-soft/70'
                        : 'border-line bg-surface hover:border-line-strong hover:bg-surface-2/60',
                    )}
                  >
                    <span
                      className={cx(
                        'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md',
                        active ? 'bg-primary text-primary-ink' : 'bg-surface-2 text-ink-muted',
                      )}
                    >
                      <Icon name={TYPE_ICONS[item.id]} size={15} />
                    </span>
                    <span className="min-w-0">
                      <span className={cx('block text-[13px] font-semibold', active ? 'text-primary' : 'text-ink')}>
                        {item.label}
                      </span>
                      <span className="mt-0.5 block text-[11px] leading-snug text-ink-muted">{item.description}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          </section>

          <section className="rounded-[12px] border border-line bg-surface px-4 py-4 sm:px-5">
            <h2 className="text-[15px] font-semibold text-ink">2. Format dan cakupan</h2>

            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <div>
                <p id="format-label" className="mb-1.5 text-[13px] font-medium text-ink">
                  Format file
                </p>
                <div role="radiogroup" aria-labelledby="format-label" className="flex flex-wrap gap-1.5">
                  {(['docx', 'pdf', 'csv'] as const).map((item) => {
                    const available = formats.includes(item)
                    return (
                      <button
                        key={item}
                        type="button"
                        role="radio"
                        aria-checked={format === item}
                        disabled={!available}
                        onClick={() => {
                          setFormat(item)
                          setError(null)
                        }}
                        className={cx(
                          'inline-flex h-10 min-w-[4.5rem] items-center justify-center gap-1.5 rounded-[9px] border px-3 text-[13px] font-medium transition-colors duration-150 max-sm:h-11',
                          format === item
                            ? 'border-primary bg-primary text-primary-ink'
                            : 'border-line-strong bg-surface text-ink hover:bg-surface-2',
                          !available && 'cursor-not-allowed opacity-40',
                        )}
                      >
                        {item.toUpperCase()}
                      </button>
                    )
                  })}
                </div>
                <p className="mt-1.5 text-[11px] leading-relaxed text-ink-muted">
                  {csvRestricted
                    ? 'CSV tidak tersedia untuk jenis ini karena isinya berbentuk narasi bertingkat.'
                    : 'CSV membuka tabel untuk diolah di aplikasi spreadsheet.'}
                </p>
              </div>

              <div>
                <label htmlFor="ekspor-cakupan" className="mb-1.5 block text-[13px] font-medium text-ink">
                  Cakupan data
                </label>
                <Select
                  id="ekspor-cakupan"
                  value={scope}
                  onChange={(event) => handleScope(event.target.value as ExportScope)}
                >
                  <option value="project">Seluruh proyek</option>
                  <option value="respondent">Satu narasumber</option>
                  <option value="session">Satu sesi</option>
                </Select>
              </div>
            </div>

            <div className="mt-4">
              {scope === 'project' ? (
                <p className="mb-1.5 text-[13px] font-medium text-ink">Cakupan terpilih</p>
              ) : (
                <label htmlFor="ekspor-cakupan-id" className="mb-1.5 block text-[13px] font-medium text-ink">
                  {scope === 'respondent' ? 'Narasumber' : 'Sesi'}
                </label>
              )}
              {scopeField}
            </div>

            <div className="mt-4 border-t border-line pt-3.5">
              <Switch
                checked={anonymize}
                onChange={setAnonymize}
                label="Sembunyikan nama narasumber"
                description="File hanya memuat kode narasumber. Nama tetap tersimpan pada data proyek."
              />
            </div>

            {csvEmpty ? (
              <InlineNotice tone="warn" className="mt-3">
                Tabel CSV pada cakupan ini belum memiliki baris jawaban. File akan berisi header saja.
              </InlineNotice>
            ) : null}

            {!scopeValid ? (
              <InlineNotice tone="warn" className="mt-3">
                Pilih narasumber atau sesi terlebih dahulu. Tombol buat file dinonaktifkan sampai cakupan valid.
              </InlineNotice>
            ) : null}

            {!formatValid ? (
              <InlineNotice tone="warn" className="mt-3">
                Format {format.toUpperCase()} tidak tersedia untuk jenis ekspor ini. Pilih format lain sebelum membuat
                file.
              </InlineNotice>
            ) : null}
          </section>

          <section className="rounded-[12px] border border-line bg-surface px-4 py-4 sm:px-5" aria-labelledby="pratinjau-ekspor">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 id="pratinjau-ekspor" className="text-[15px] font-semibold text-ink">
                  3. Pratinjau isi file
                </h2>
                <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">
                  Pratinjau teks. Tata letak DOCX dan PDF mengikuti isi ini.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone="neutral">{previewLineCount} baris</Badge>
                <Button size="sm" variant="secondary" icon="copy" onClick={() => void handleCopy()} disabled={!previewText}>
                  Salin teks
                </Button>
              </div>
            </div>

            {error ? (
              <InlineNotice tone="danger" title="Ekspor tidak dapat dibuat" className="mt-3">
                {error}
              </InlineNotice>
            ) : null}

            {!preview ? (
              <div className="mt-3 rounded-[9px] border border-dashed border-line-strong px-4 py-8 text-center">
                <p className="text-[13px] font-medium text-ink">Pratinjau belum tersedia</p>
                <p className="mt-1 text-xs text-ink-muted">Lengkapi pilihan cakupan untuk melihat isi file.</p>
              </div>
            ) : (
              <>
                <div className="mt-3 rounded-[9px] border border-line bg-surface-2/40 px-3.5 py-3">
                  <p className="text-[13px] font-semibold text-ink">{preview.title}</p>
                  <p className="mt-0.5 text-xs text-ink-muted">{preview.subtitle}</p>
                  <ul className="mt-2 space-y-1">
                    {preview.meta.map((item) => (
                      <li key={item} className="flex items-start gap-2 text-[11px] leading-relaxed text-ink-muted">
                        <span className="mt-[0.45rem] h-1 w-1 shrink-0 rounded-full bg-line-strong" aria-hidden="true" />
                        <span className="min-w-0">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <pre className="mt-3 max-h-[30rem] overflow-auto whitespace-pre-wrap break-words rounded-[9px] border border-line bg-surface-2/50 p-3 font-mono text-[11px] leading-relaxed text-ink-soft">
                  {previewText}
                </pre>
              </>
            )}
          </section>
        </div>

        <aside className="space-y-4 xl:sticky xl:top-20">
          <section className="rounded-[12px] border border-line bg-surface px-4 py-4" aria-labelledby="ringkasan-ekspor">
            <h2 id="ringkasan-ekspor" className="text-[13px] font-semibold text-ink">
              Ringkasan pilihan
            </h2>
            <dl className="mt-2.5 space-y-2 text-[12px]">
              <div className="flex items-start justify-between gap-3">
                <dt className="text-ink-muted">Jenis</dt>
                <dd className="text-right font-medium text-ink">{selectedType?.label ?? type}</dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-ink-muted">Format</dt>
                <dd className="font-medium uppercase text-ink">{format}</dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-ink-muted">Cakupan</dt>
                <dd className="max-w-[60%] text-right font-medium text-ink">{scopeLabel(options, data)}</dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-ink-muted">Identitas</dt>
                <dd className="font-medium text-ink">{anonymize ? 'Kode saja' : 'Kode dan nama'}</dd>
              </div>
              <div className="flex items-start justify-between gap-3 border-t border-line pt-2">
                <dt className="text-ink-muted">Kelengkapan jawaban</dt>
                <dd className="font-medium text-ink">
                  {preview ? preview.coverageNote : 'Belum dihitung'}
                </dd>
              </div>
            </dl>
            <Button
              variant="primary"
              icon="download"
              className="mt-3 w-full"
              onClick={() => void handleGenerate()}
              disabled={busy || !preview || !scopeValid || !formatValid}
            >
              {busy ? <Spinner size={15} /> : null}
              {busy ? 'Membuat file…' : `Unduh ${format.toUpperCase()}`}
            </Button>
            <p className="mt-2 text-[11px] leading-relaxed text-ink-muted">
              File dibuat di perangkat ini. Riwayat di bawah hanya mencatat file yang pernah dibuat, bukan menyimpan
              salinan file.
            </p>
          </section>

          <section className="rounded-[12px] border border-line bg-surface px-4 py-4" aria-labelledby="riwayat-ekspor">
            <div className="flex items-center justify-between gap-2">
              <h2 id="riwayat-ekspor" className="text-[13px] font-semibold text-ink">
                Riwayat ekspor
              </h2>
              <Badge tone="neutral">{history.length}</Badge>
            </div>
            {history.length === 0 ? (
              <p className="mt-2.5 rounded-[8px] border border-dashed border-line-strong px-3 py-3 text-[11px] leading-relaxed text-ink-muted">
                Belum ada file yang dibuat dari proyek ini.
              </p>
            ) : (
              <ul className="mt-2 divide-y divide-line">
                {history.slice(0, 8).map((record) => {
                  const definition = typeDefinition(record.type)
                  return (
                    <li key={record.id} className="py-2.5 first:pt-0 last:pb-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-[12px] font-medium text-ink">
                            {definition?.label ?? record.type}
                          </p>
                          <p className="mono-meta mt-0.5 truncate text-ink-muted">{record.fileName}</p>
                          <p className="mt-0.5 text-[10.5px] leading-snug text-ink-muted">
                            {record.format.toUpperCase()} · {record.scopeLabel} ·{' '}
                            {record.anonymized ? 'anonim' : 'dengan nama'}
                          </p>
                          <p className="mono-meta mt-0.5 text-ink-muted">{formatDate(record.createdAt, true)}</p>
                        </div>
                        <div className="flex shrink-0 items-center">
                          <IconButton
                            label="Salin pengaturan ekspor"
                            icon="refresh"
                            size="sm"
                            onClick={() => handleReuse(record)}
                          />
                          <IconButton
                            label="Hapus catatan riwayat"
                            icon="trash"
                            size="sm"
                            danger
                            onClick={() => setDeleting(record)}
                          />
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
            {history.length > 8 ? (
              <p className="mt-2 text-[11px] text-ink-muted">Dan {history.length - 8} catatan lainnya.</p>
            ) : null}
          </section>

          <section className="rounded-[12px] border border-line bg-surface-2/50 px-4 py-3.5">
            <p className="mono-meta uppercase text-ink-muted">Catatan</p>
            <p className="mt-1 text-[11px] leading-relaxed text-ink-muted">
              Kutipan dan jawaban diambil dari data yang tersimpan. Bagian analisis tetap merupakan interpretasi
              peneliti dan tidak dibuat otomatis oleh aplikasi.
            </p>
          </section>
        </aside>
      </div>

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={() => void confirmDelete()}
        busy={deletingBusy}
        title="Hapus catatan riwayat ekspor?"
        description="Catatan ini hanya menandai bahwa file pernah dibuat."
        impact="File yang sudah diunduh tidak terpengaruh. Data proyek, jawaban, dan analisis tetap tersimpan."
        confirmLabel="Hapus catatan"
      />
    </>
  )
}
