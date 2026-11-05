import { useEffect, useState } from 'react'
import type { Project } from '../lib/types'
import { useWorkspace } from '../lib/store'
import { Button, Checkbox, Field, Input, Modal, Textarea, useToast } from './ui'

interface ProjectDialogProps {
  open: boolean
  onClose: () => void
  project?: Project
  onCreated?: (project: Project) => void
}

interface FormState {
  title: string
  description: string
  objective: string
  generalNotes: string
  backupEnabled: boolean
}

const EMPTY_FORM: FormState = { title: '', description: '', objective: '', generalNotes: '', backupEnabled: false }

export function ProjectDialog({ open, onClose, project, onCreated }: ProjectDialogProps) {
  const { createProject, updateProject } = useWorkspace()
  const { notify } = useToast()
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({})
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    setForm(
      project
        ? {
            title: project.title,
            description: project.description,
            objective: project.objective,
            generalNotes: project.generalNotes,
            backupEnabled: project.backupEnabled ?? false,
          }
        : EMPTY_FORM,
    )
    setErrors({})
    setBusy(false)
  }, [open, project])

  const set = (key: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  const validate = (): boolean => {
    const next: Partial<Record<keyof FormState, string>> = {}
    const title = form.title.trim()
    if (!title) next.title = 'Nama proyek wajib diisi.'
    else if (title.length < 3) next.title = 'Gunakan minimal 3 karakter agar proyek mudah dikenali.'
    else if (title.length > 120) next.title = 'Nama proyek maksimal 120 karakter.'
    if (form.description.length > 600) next.description = 'Deskripsi maksimal 600 karakter.'
    if (form.objective.length > 400) next.objective = 'Tujuan maksimal 400 karakter.'
    if (form.generalNotes.length > 3000) next.generalNotes = 'Catatan maksimal 3000 karakter.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const submit = async () => {
    if (!validate()) return
    setBusy(true)
    try {
      if (project) {
        const ok = await updateProject(project.id, {
          title: form.title.trim(),
          description: form.description.trim(),
          objective: form.objective.trim(),
          generalNotes: form.generalNotes.trim(),
          backupEnabled: form.backupEnabled,
        })
        if (!ok) {
          setErrors({ title: 'Perubahan belum tersimpan. Periksa ruang penyimpanan browser lalu coba lagi.' })
          return
        }
        notify('Detail proyek diperbarui.')
        onClose()
      } else {
        const created = await createProject({
          title: form.title,
          description: form.description,
          objective: form.objective,
          generalNotes: form.generalNotes,
          backupEnabled: form.backupEnabled,
        })
        if (!created) {
          setErrors({ title: 'Proyek tidak dapat dibuat. Periksa nama proyek dan ruang penyimpanan lalu coba lagi.' })
          return
        }
        notify('Proyek baru dibuat.')
        onClose()
        onCreated?.(created)
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={project ? 'Ubah detail proyek' : 'Buat proyek baru'}
      description={
        project
          ? 'Perubahan berlaku untuk seluruh proyek. Data pertanyaan dan jawaban tidak terpengaruh.'
          : 'Isi informasi dasar. Panduan, narasumber, dan sesi dapat ditambahkan setelah proyek dibuat.'
      }
      size="lg"
      preventClose={busy}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Batal
          </Button>
          <Button variant="primary" onClick={() => void submit()} disabled={busy}>
            {busy ? 'Menyimpan…' : project ? 'Simpan perubahan' : 'Buat proyek'}
          </Button>
        </>
      }
    >
      <form
        className="space-y-5"
        onSubmit={(event) => {
          event.preventDefault()
          void submit()
        }}
      >
        <Field
          label="Nama proyek"
          htmlFor="project-title"
          required
          error={errors.title}
          hint="Gunakan nama yang spesifik, misalnya “Kebiasaan Belajar Mahasiswa Baru”."
        >
          <Input
            id="project-title"
            autoFocus
            value={form.title}
            onChange={(event) => set('title', event.target.value)}
            placeholder="Nama proyek wawancara"
            maxLength={120}
            invalid={Boolean(errors.title)}
            autoComplete="off"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Deskripsi singkat"
            htmlFor="project-description"
            optional
            error={errors.description}
            hint={`${form.description.length}/600 karakter`}
          >
            <Textarea
              id="project-description"
              value={form.description}
              onChange={(event) => set('description', event.target.value)}
              placeholder="Konteks penelitian dan siapa yang diwawancarai."
              className="min-h-24"
              invalid={Boolean(errors.description)}
            />
          </Field>
          <Field
            label="Tujuan wawancara"
            htmlFor="project-objective"
            optional
            error={errors.objective}
            hint={`${form.objective.length}/400 karakter`}
          >
            <Textarea
              id="project-objective"
              value={form.objective}
              onChange={(event) => set('objective', event.target.value)}
              placeholder="Apa yang ingin dipahami dari wawancara ini?"
              className="min-h-24"
              invalid={Boolean(errors.objective)}
            />
          </Field>
        </div>

        <Field
          label="Catatan umum"
          htmlFor="project-notes"
          optional
          error={errors.generalNotes}
          hint="Konteks tambahan, batasan penelitian, atau kesepakatan dengan narasumber. Hindari menulis data pribadi yang tidak diperlukan."
        >
          <Textarea
            id="project-notes"
            value={form.generalNotes}
            onChange={(event) => set('generalNotes', event.target.value)}
            placeholder="Catatan yang perlu diingat selama proyek berjalan."
            className="min-h-20"
            invalid={Boolean(errors.generalNotes)}
          />
        </Field>

        <section className="rounded-[10px] border border-line bg-surface-2 p-3.5">
          <h3 className="text-[13px] font-semibold text-ink">Penyimpanan dan pencadangan</h3>
          <p className="mt-1 text-xs leading-relaxed text-ink-muted">
            Data proyek akan disimpan di perangkat ini.
          </p>

          <div className="mt-2.5 flex items-start gap-2.5 rounded-[8px] border border-line bg-surface px-3 py-2">
            <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded bg-success/20 text-success text-[11px] font-bold">
              ✓
            </span>
            <div className="min-w-0">
              <p className="text-[12px] font-medium text-ink">Simpan di perangkat (Selalu aktif)</p>
              <p className="text-[11px] text-ink-muted">Penyimpanan utama berbasis IndexedDB lokal. Tetap berfungsi tanpa internet.</p>
            </div>
          </div>

          <Checkbox
            className="mt-3"
            id="project-backup-enabled"
            label="Cadangkan proyek ini ke Google Drive"
            checked={form.backupEnabled}
            onChange={(event) => setForm((prev) => ({ ...prev, backupEnabled: event.target.checked }))}
            description="Cadangan Google Drive bersifat opsional. Data tetap tersimpan secara lokal meskipun Anda tidak mengaktifkan pencadangan."
          />
        </section>

        <button type="submit" className="hidden" tabIndex={-1} aria-hidden="true">
          Simpan
        </button>
      </form>
    </Modal>
  )
}
