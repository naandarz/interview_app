import { useState } from 'react'
import { useWorkspace } from '../lib/store'
import { Icon } from '../components/Icon'
import { Button, Checkbox, Field, InlineNotice, Input, Spinner, useToast } from '../components/ui'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const POINTS = [
  {
    icon: 'database' as const,
    title: 'Tersimpan di perangkat ini',
    detail: 'Proyek, jawaban, dan analisis disimpan di IndexedDB browser. Tidak ada unggahan ke server.',
  },
  {
    icon: 'guide' as const,
    title: 'Alur penelitian yang utuh',
    detail: 'Susun panduan, catat sesi, beri kode, bentuk tema, lalu ekspor dalam DOCX, PDF, atau CSV.',
  },
  {
    icon: 'download' as const,
    title: 'Anda memegang cadangannya',
    detail: 'Unduh cadangan JSON kapan saja dari Pengaturan. Data tetap dapat dipulihkan di perangkat lain.',
  },
]

export function Onboarding() {
  const { saveProfile, dismissOnboarding, storageError } = useWorkspace()
  const { notify } = useToast()

  const [form, setForm] = useState({ name: '', email: '', institution: '' })
  const [errors, setErrors] = useState<Partial<Record<'name' | 'email' | 'institution' | 'consent', string>>>({})
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const setField = (key: 'name' | 'email' | 'institution', value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }))
    if (submitError) setSubmitError(null)
  }

  const handleSkip = async () => {
    setBusy(true)
    setSubmitError(null)
    try {
      await dismissOnboarding()
      notify('Selamat datang di Interview Workspace.')
    } catch {
      setSubmitError('Gagal membuka ruang kerja. Coba muat ulang halaman.')
    } finally {
      setBusy(false)
    }
  }

  const submit = async () => {
    const next: typeof errors = {}
    const name = form.name.trim()
    const email = form.email.trim()
    if (!name) next.name = 'Nama wajib diisi untuk menyimpan profil.'
    else if (name.length < 2) next.name = 'Gunakan minimal 2 karakter.'
    else if (name.length > 80) next.name = 'Nama maksimal 80 karakter.'
    if (email && !EMAIL_PATTERN.test(email)) next.email = 'Format email belum benar, misalnya nama@contoh.id.'
    else if (email.length > 120) next.email = 'Email maksimal 120 karakter.'
    if (form.institution.length > 120) next.institution = 'Institusi maksimal 120 karakter.'
    if (!consent) next.consent = 'Centang pernyataan penyimpanan lokal untuk melanjutkan.'
    setErrors(next)
    if (Object.keys(next).length > 0) return

    setBusy(true)
    setSubmitError(null)
    try {
      await saveProfile({ name, email, institution: form.institution.trim() })
      notify('Profil tersimpan. Ruang kerja siap digunakan.')
    } catch {
      setSubmitError(
        'Profil tidak dapat disimpan. Pastikan browser mengizinkan IndexedDB dan bukan mode privat, lalu coba lagi.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative min-h-dvh bg-paper">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full border border-line/70" />
        <div className="absolute -right-10 top-10 h-40 w-40 rounded-full border border-line/60" />
        <div className="absolute bottom-10 left-8 hidden h-24 w-px bg-line lg:block" />
        <div className="absolute bottom-10 left-8 hidden h-px w-24 bg-line lg:block" />
      </div>

      <div className="relative mx-auto flex min-h-dvh w-full max-w-[1120px] flex-col px-4 py-8 sm:px-6 sm:py-12 lg:justify-center">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,460px)] lg:items-center lg:gap-12">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-[9px] bg-primary text-primary-ink shadow-[0_1px_0_rgba(0,0,0,0.08)]">
                <Icon name="guide" size={19} />
                <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full border border-paper bg-accent" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block text-[15px] font-semibold leading-tight tracking-[-0.01em] text-ink">
                  Interview Workspace
                </span>
                <span className="mono-meta mt-0.5 block text-[10px] uppercase text-ink-muted">Catatan lapangan</span>
              </span>
            </div>

            <p className="mono-meta mt-8 uppercase text-accent sm:mt-10">Ruang kerja wawancara kualitatif</p>
            <h1 className="mt-2 max-w-xl text-[28px] font-semibold leading-[1.15] tracking-[-0.03em] text-ink sm:text-[38px]">
              Dari panduan wawancara sampai laporan, dalam satu tempat.
            </h1>
            <p className="mt-3 max-w-lg text-sm leading-relaxed text-ink-soft sm:text-[15px]">
              Aplikasi ini membantu menyusun pertanyaan, mencatat jawaban, memberi kode, dan membaca tema. Semua data
              tetap di perangkat ini.
            </p>

            <dl className="mt-7 grid gap-3 sm:mt-9">
              {POINTS.map((point) => (
                <div key={point.title} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] border border-line bg-surface text-primary">
                    <Icon name={point.icon} size={15} />
                  </span>
                  <div className="min-w-0">
                    <dt className="text-[13px] font-semibold text-ink">{point.title}</dt>
                    <dd className="mt-0.5 max-w-md text-[12px] leading-relaxed text-ink-muted">{point.detail}</dd>
                  </div>
                </div>
              ))}
            </dl>

            <p className="mt-7 flex max-w-lg items-start gap-2 border-t border-line pt-4 text-[11px] leading-relaxed text-ink-muted">
              <Icon name="lock" size={14} className="mt-0.5 shrink-0 text-ink-muted" />
              Profil di halaman ini adalah label identitas lokal, bukan enkripsi. Siapa pun yang dapat membuka browser
              ini dapat melihat data yang tersimpan.
            </p>
          </div>

          <div className="rounded-[14px] border border-line bg-surface px-4 py-5 shadow-[0_18px_50px_-32px_rgba(20,35,26,0.4)] sm:px-6 sm:py-6">
            <p className="mono-meta uppercase text-ink-muted">Langkah awal</p>
            <h2 className="mt-1 text-[20px] font-semibold leading-snug tracking-[-0.02em] text-ink">
              Isi profil ruang kerja
            </h2>
            <p className="mt-1.5 text-[12px] leading-relaxed text-ink-muted">
              Profil dipakai untuk menandai proyek dan ekspor. Anda dapat mengubahnya nanti di Pengaturan.
            </p>

            {storageError ? (
              <InlineNotice tone="danger" title="Penyimpanan browser tidak tersedia" className="mt-4">
                {storageError} Data tidak akan tersimpan sampai masalah ini diperbaiki. Coba muat ulang halaman atau
                gunakan jendela browser biasa.
              </InlineNotice>
            ) : null}

            <form
              className="mt-5 space-y-4"
              onSubmit={(event) => {
                event.preventDefault()
                void submit()
              }}
            >
              <Field label="Nama" htmlFor="onboarding-name" required error={errors.name}>
                <Input
                  id="onboarding-name"
                  value={form.name}
                  onChange={(event) => setField('name', event.target.value)}
                  placeholder="Nama Anda"
                  autoComplete="name"
                  maxLength={80}
                  invalid={Boolean(errors.name)}
                  autoFocus
                />
              </Field>

              <Field label="Email" htmlFor="onboarding-email" optional error={errors.email} hint="Opsional, hanya sebagai identitas lokal.">
                <Input
                  id="onboarding-email"
                  type="email"
                  value={form.email}
                  onChange={(event) => setField('email', event.target.value)}
                  placeholder="nama@contoh.id"
                  autoComplete="email"
                  maxLength={120}
                  invalid={Boolean(errors.email)}
                />
              </Field>

              <Field
                label="Institusi atau komunitas"
                htmlFor="onboarding-institution"
                optional
                error={errors.institution}
                hint="Contoh: Universitas, tim riset, atau organisasi."
              >
                <Input
                  id="onboarding-institution"
                  value={form.institution}
                  onChange={(event) => setField('institution', event.target.value)}
                  placeholder="Nama institusi"
                  autoComplete="organization"
                  maxLength={120}
                  invalid={Boolean(errors.institution)}
                />
              </Field>

              <div>
                <Checkbox
                  checked={consent}
                  onChange={(event) => {
                    setConsent(event.target.checked)
                    if (errors.consent) setErrors((prev) => ({ ...prev, consent: undefined }))
                  }}
                  label="Saya memahami data tersimpan di perangkat ini."
                  description="Menghapus data situs atau memakai mode privat dapat menghilangkan data. Cadangkan secara berkala dari Pengaturan."
                />
                {errors.consent ? (
                  <p className="mt-1.5 flex items-start gap-1.5 text-xs text-danger" role="alert">
                    <Icon name="alert" size={13} className="mt-0.5 shrink-0" />
                    {errors.consent}
                  </p>
                ) : null}
              </div>

              {submitError ? (
                <InlineNotice tone="danger" title="Profil belum tersimpan">
                  {submitError}
                </InlineNotice>
              ) : null}

              <div className="flex flex-col gap-2.5 pt-2">
                <Button type="submit" variant="primary" className="w-full" iconRight="arrowRight" disabled={busy}>
                  {busy ? <Spinner size={15} /> : null}
                  {busy ? 'Menyiapkan ruang kerja…' : 'Simpan profil & buka ruang kerja'}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full"
                  onClick={() => void handleSkip()}
                  disabled={busy}
                >
                  Lewati & langsung buka Dashboard
                </Button>
              </div>
            </form>

            <p className="mt-3 text-center text-[11px] leading-relaxed text-ink-muted">
              Tanpa pendaftaran daring. Tidak ada data yang dikirim ke pihak ketiga.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
