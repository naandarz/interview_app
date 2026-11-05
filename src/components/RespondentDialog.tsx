import { useEffect, useMemo, useState } from 'react'
import { useWorkspace } from '../lib/store'
import type { Respondent } from '../lib/types'
import { nextRespondentCode } from '../lib/hooks'
import { Field, InlineNotice, Input, Modal, Textarea, Button, useToast } from './ui'

const CODE_PATTERN = /^[A-Za-z0-9._-]{1,20}$/

export function RespondentDialog({
  open,
  onClose,
  projectId,
  respondent,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  projectId: string
  respondent?: Respondent
  onSaved?: (respondent: Respondent) => void
}) {
  const { data, createRespondent, updateRespondent } = useWorkspace()
  const { notify } = useToast()
  const [code, setCode] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [profileNotes, setProfileNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const existing = useMemo(
    () => data.respondents.filter((item) => item.projectId === projectId && !item.archivedAt),
    [data.respondents, projectId],
  )

  useEffect(() => {
    if (!open) return
    setCode(respondent?.code ?? nextRespondentCode(existing.map((item) => item.code)))
    setDisplayName(respondent?.displayName ?? '')
    setProfileNotes(respondent?.profileNotes ?? '')
    setError(null)
    setBusy(false)
  }, [open, respondent, existing])

  const duplicate = existing.some(
    (item) => item.id !== respondent?.id && item.code.toLowerCase() === code.trim().toLowerCase(),
  )

  const save = async () => {
    const value = code.trim()
    if (!value) {
      setError('Kode narasumber wajib diisi.')
      return
    }
    if (!CODE_PATTERN.test(value)) {
      setError('Kode hanya boleh berisi huruf, angka, titik, garis bawah, atau tanda hubung (maksimal 20 karakter).')
      return
    }
    if (duplicate) {
      setError(`Kode ${value} sudah dipakai narasumber aktif lain pada proyek ini.`)
      return
    }
    if (displayName.trim().length > 120) {
      setError('Nama tampilan maksimal 120 karakter.')
      return
    }
    setBusy(true)
    try {
      if (respondent) {
        await updateRespondent(respondent.id, {
          code: value,
          displayName: displayName.trim(),
          profileNotes: profileNotes.trim(),
        })
        notify('Data narasumber diperbarui.')
        onSaved?.({ ...respondent, code: value, displayName: displayName.trim(), profileNotes: profileNotes.trim() })
      } else {
        const result = await createRespondent({
          projectId,
          code: value,
          displayName: displayName.trim(),
          profileNotes: profileNotes.trim(),
        })
        if (!result.ok || !result.respondent) {
          setError(result.error ?? 'Narasumber tidak dapat ditambahkan. Coba lagi.')
          return
        }
        notify(`Narasumber ${result.respondent.code} ditambahkan.`)
        onSaved?.(result.respondent)
      }
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={respondent ? `Ubah narasumber ${respondent.code}` : 'Tambah narasumber'}
      description="Gunakan kode agar identitas tetap ringkas. Nama asli bersifat opsional."
      size="md"
      preventClose={busy}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Batal
          </Button>
          <Button variant="primary" onClick={() => void save()} disabled={busy || duplicate}>
            {busy ? 'Menyimpan…' : respondent ? 'Simpan perubahan' : 'Tambah narasumber'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-[140px_minmax(0,1fr)]">
          <Field
            label="Kode"
            htmlFor="respondent-code"
            required
            error={duplicate ? `Kode ${code.trim()} sudah dipakai.` : undefined}
            hint={`${code.length}/20 karakter.`}
          >
            <Input
              id="respondent-code"
              value={code}
              onChange={(event) => {
                setCode(event.target.value.toUpperCase())
                if (error) setError(null)
              }}
              maxLength={20}
              placeholder="R01"
              invalid={duplicate}
              autoFocus
              className="font-mono uppercase"
            />
          </Field>
          <Field label="Nama tampilan" htmlFor="respondent-name" optional hint="Boleh dikosongkan bila narasumber perlu tetap anonim.">
            <Input
              id="respondent-name"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              maxLength={120}
              placeholder="Contoh: Peserta 1"
            />
          </Field>
        </div>

        <Field
          label="Catatan profil"
          htmlFor="respondent-notes"
          optional
          hint="Konteks yang relevan, misalnya peran, lama pengalaman, atau kriteria pemilihan. Jangan mencatat data pribadi yang tidak diperlukan."
        >
          <Textarea
            id="respondent-notes"
            value={profileNotes}
            onChange={(event) => setProfileNotes(event.target.value)}
            maxLength={1000}
            className="min-h-24"
            placeholder="Contoh: Mahasiswa semester 4, aktif mengikuti organisasi."
          />
        </Field>

        {error ? <InlineNotice tone="danger">{error}</InlineNotice> : null}
        {!error && duplicate ? (
          <InlineNotice tone="warn">Kode harus unik agar jawaban tidak tertukar. Gunakan kode lain, misalnya {nextRespondentCode(existing.map((item) => item.code))}.</InlineNotice>
        ) : null}
      </div>
    </Modal>
  )
}
