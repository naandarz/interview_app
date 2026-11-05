import { useEffect, useMemo, useState } from 'react'
import { useWorkspace } from '../lib/store'
import type { InterviewSession } from '../lib/types'
import { METHODS } from '../lib/types'
import { dateInputToIso, isoToDateInput, todayInput } from '../lib/utils'
import { Button, Field, InlineNotice, Input, Modal, Select, Textarea, useToast } from './ui'

export function SessionDialog({
  open,
  onClose,
  projectId,
  session,
  defaultRespondentId,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  projectId: string
  session?: InterviewSession
  defaultRespondentId?: string
  onSaved?: (session: InterviewSession) => void
}) {
  const { data, createSession, updateSession } = useWorkspace()
  const { notify } = useToast()
  const [respondentId, setRespondentId] = useState('')
  const [title, setTitle] = useState('')
  const [date, setDate] = useState(todayInput())
  const [method, setMethod] = useState<InterviewSession['method']>('Tatap muka')
  const [interviewer, setInterviewer] = useState('')
  const [duration, setDuration] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const respondents = useMemo(() => {
    return data.respondents
      .filter((respondent) => respondent.projectId === projectId && (!respondent.archivedAt || respondent.id === session?.respondentId))
      .sort((a, b) => a.code.localeCompare(b.code, 'id'))
  }, [data.respondents, projectId, session?.respondentId])

  useEffect(() => {
    if (!open) return
    setRespondentId(session?.respondentId ?? defaultRespondentId ?? respondents[0]?.id ?? '')
    setTitle(session?.title ?? '')
    setDate(session ? isoToDateInput(session.interviewDate) : todayInput())
    setMethod(session?.method ?? 'Tatap muka')
    setInterviewer(session?.interviewerName ?? '')
    setDuration(session?.durationMinutes ? String(session.durationMinutes) : '')
    setNotes(session?.notes ?? '')
    setError(null)
    setBusy(false)
  }, [open, session, defaultRespondentId, respondents])

  const selected = respondents.find((respondent) => respondent.id === respondentId)

  const save = async () => {
    if (!respondentId) {
      setError('Pilih narasumber untuk sesi ini.')
      return
    }
    if (!date) {
      setError('Tanggal wawancara wajib diisi.')
      return
    }
    const durationValue = duration.trim() === '' ? null : Number(duration)
    if (durationValue !== null && (!Number.isFinite(durationValue) || durationValue <= 0 || durationValue > 600)) {
      setError('Durasi harus berupa angka antara 1 dan 600 menit, atau dikosongkan.')
      return
    }
    if (title.trim().length > 120) {
      setError('Judul sesi maksimal 120 karakter.')
      return
    }
    setBusy(true)
    try {
      if (session) {
        await updateSession(session.id, {
          respondentId,
          title: title.trim() || `Wawancara ${selected?.code ?? ''}`.trim(),
          interviewDate: dateInputToIso(date),
          method,
          interviewerName: interviewer.trim(),
          durationMinutes: durationValue,
          notes: notes.trim(),
        })
        notify('Detail sesi diperbarui.')
        onSaved?.({
          ...session,
          respondentId,
          title: title.trim() || `Wawancara ${selected?.code ?? ''}`.trim(),
          interviewDate: dateInputToIso(date),
          method,
          interviewerName: interviewer.trim(),
          durationMinutes: durationValue,
          notes: notes.trim(),
        })
      } else {
        const created = await createSession({
          projectId,
          respondentId,
          title: title.trim() || `Wawancara ${selected?.code ?? ''}`.trim(),
          interviewDate: dateInputToIso(date),
          method,
          interviewerName: interviewer.trim(),
          durationMinutes: durationValue,
          notes: notes.trim(),
        })
        if (!created) {
          setError('Sesi tidak dapat dibuat. Pastikan narasumber masih aktif.')
          return
        }
        notify('Sesi dibuat. Jawaban dapat diisi dan tersimpan otomatis.')
        onSaved?.(created)
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
      title={session ? 'Ubah detail sesi' : 'Sesi wawancara baru'}
      description={
        session
          ? 'Perubahan berlaku pada sesi ini. Jawaban yang sudah ada tidak berubah.'
          : 'Sesi menyalin daftar pertanyaan aktif saat dibuat. Pertanyaan baru dapat disegarkan dari ruang sesi.'
      }
      size="lg"
      preventClose={busy}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Batal
          </Button>
          <Button variant="primary" onClick={() => void save()} disabled={busy || respondents.length === 0}>
            {busy ? 'Menyimpan…' : session ? 'Simpan perubahan' : 'Buat sesi'}
          </Button>
        </>
      }
    >
      {respondents.length === 0 ? (
        <InlineNotice tone="warn" title="Belum ada narasumber aktif">
          Tambahkan narasumber terlebih dahulu, lalu buat sesi dari halaman narasumber atau dari sini.
        </InlineNotice>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Narasumber" htmlFor="session-respondent" required hint={selected ? `Kode ${selected.code}${selected.displayName ? ` · ${selected.displayName}` : ''}` : undefined}>
              <Select
                id="session-respondent"
                value={respondentId}
                onChange={(event) => {
                  setRespondentId(event.target.value)
                  if (error) setError(null)
                }}
              >
                <option value="">Pilih narasumber</option>
                {respondents.map((respondent) => (
                  <option key={respondent.id} value={respondent.id}>
                    {respondent.code}
                    {respondent.displayName ? ` · ${respondent.displayName}` : ''}
                    {respondent.archivedAt ? ' (diarsipkan)' : ''}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Judul sesi" htmlFor="session-title" optional hint="Dikosongkan akan memakai “Wawancara [kode]”.">
              <Input
                id="session-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={120}
                placeholder={selected ? `Wawancara ${selected.code}` : 'Wawancara R01'}
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Tanggal" htmlFor="session-date" required>
              <Input
                id="session-date"
                type="date"
                value={date}
                onChange={(event) => {
                  setDate(event.target.value)
                  if (error) setError(null)
                }}
              />
            </Field>
            <Field label="Metode" htmlFor="session-method" required>
              <Select id="session-method" value={method} onChange={(event) => setMethod(event.target.value as InterviewSession['method'])}>
                {METHODS.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Durasi" htmlFor="session-duration" optional hint="Dalam menit.">
              <Input
                id="session-duration"
                type="number"
                inputMode="numeric"
                min={1}
                max={600}
                value={duration}
                onChange={(event) => setDuration(event.target.value)}
                placeholder="45"
              />
            </Field>
          </div>

          <Field label="Pewawancara" htmlFor="session-interviewer" optional>
            <Input
              id="session-interviewer"
              value={interviewer}
              onChange={(event) => setInterviewer(event.target.value)}
              maxLength={120}
              placeholder="Nama atau inisial pewawancara"
            />
          </Field>

          <Field
            label="Catatan sesi"
            htmlFor="session-notes"
            optional
            hint="Konteks umum sesi, kondisi wawancara, atau hal yang perlu diingat saat analisis."
          >
            <Textarea
              id="session-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              maxLength={2000}
              className="min-h-24"
              placeholder="Contoh: Wawancara dilakukan daring, koneksi sempat terputus sekali."
            />
          </Field>

          {error ? <InlineNotice tone="danger">{error}</InlineNotice> : null}
        </div>
      )}
    </Modal>
  )
}
