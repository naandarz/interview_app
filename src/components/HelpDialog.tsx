import { useState } from 'react'
import { Icon } from './Icon'
import { Button, Modal, useToast } from './ui'

interface HelpDialogProps {
  open: boolean
  onClose: () => void
}

export function HelpDialog({ open, onClose }: HelpDialogProps) {
  const { notify } = useToast()
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  const handleCopy = async (key: string, text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedKey(key)
      notify(`${label} berhasil disalin ke papan klip.`)
      setTimeout(() => setCopiedKey(null), 2000)
    } catch {
      notify('Gagal menyalin. Silakan salin manual.')
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Bantuan & Kontak Pengembang"
      description="Pertanyaan, kendala, atau saran pengembangan dapat disampaikan langsung kepada pengembang."
      size="md"
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          <p className="text-[11px] text-ink-muted">Interview Workspace</p>
          <Button variant="secondary" onClick={onClose}>
            Tutup
          </Button>
        </div>
      }
    >
      <div className="space-y-5 text-sm">
        {/* Developer Contact Card */}
        <div className="rounded-[12px] border border-line bg-surface-2/40 p-4 sm:p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary font-semibold">
              <Icon name="user" size={18} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="mono-meta uppercase text-ink-muted">Pengembang Aplikasi</p>
              <h3 className="text-[15px] font-semibold text-ink">naandarz</h3>
            </div>
            <a
              href="https://github.com/naandarz"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-surface-2"
            >
              <Icon name="github" size={14} />
              <span>Profil GitHub</span>
              <Icon name="external" size={12} className="text-ink-muted" />
            </a>
          </div>

          <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
            {/* Email item */}
            <div className="flex flex-col justify-between rounded-[9px] border border-line bg-surface p-3">
              <div className="flex items-center gap-2 text-ink-muted">
                <Icon name="mail" size={14} className="text-primary" />
                <span className="mono-meta uppercase">Email</span>
              </div>
              <p className="mt-1 truncate font-mono text-[13px] font-medium text-ink select-all">
                nndarz03@gmail.com
              </p>
              <div className="mt-2.5 flex items-center gap-1.5 pt-1 border-t border-line/60">
                <a
                  href="mailto:nndarz03@gmail.com"
                  className="inline-flex min-h-8 flex-1 items-center justify-center gap-1 rounded bg-primary-soft px-2 py-1 text-xs font-medium text-primary hover:bg-primary hover:text-primary-ink transition-colors"
                >
                  Kirim Email
                </a>
                <button
                  type="button"
                  onClick={() => void handleCopy('email', 'nndarz03@gmail.com', 'Email')}
                  className="inline-flex min-h-8 items-center justify-center gap-1 rounded border border-line px-2.5 py-1 text-xs font-medium text-ink-muted hover:bg-surface-2 hover:text-ink transition-colors"
                  title="Salin email"
                >
                  <Icon name={copiedKey === 'email' ? 'check' : 'copy'} size={13} />
                  <span>{copiedKey === 'email' ? 'Tersalin' : 'Salin'}</span>
                </button>
              </div>
            </div>

            {/* Phone/WhatsApp item */}
            <div className="flex flex-col justify-between rounded-[9px] border border-line bg-surface p-3">
              <div className="flex items-center gap-2 text-ink-muted">
                <Icon name="phone" size={14} className="text-success" />
                <span className="mono-meta uppercase">WhatsApp / Telepon</span>
              </div>
              <p className="mt-1 font-mono text-[13px] font-medium text-ink select-all">
                085601689713
              </p>
              <div className="mt-2.5 flex items-center gap-1.5 pt-1 border-t border-line/60">
                <a
                  href="https://wa.me/6285601689713"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-8 flex-1 items-center justify-center gap-1 rounded bg-success-soft px-2 py-1 text-xs font-medium text-success hover:bg-success hover:text-primary-ink transition-colors"
                >
                  Chat WhatsApp
                </a>
                <a
                  href="tel:085601689713"
                  className="inline-flex min-h-8 items-center justify-center gap-1 rounded border border-line px-2 py-1 text-xs font-medium text-ink-muted hover:bg-surface-2 hover:text-ink transition-colors"
                  title="Panggil via telepon"
                >
                  Telpon
                </a>
                <button
                  type="button"
                  onClick={() => void handleCopy('phone', '085601689713', 'Nomor telepon')}
                  className="inline-flex min-h-8 items-center justify-center gap-1 rounded border border-line px-2 py-1 text-xs font-medium text-ink-muted hover:bg-surface-2 hover:text-ink transition-colors"
                  title="Salin nomor"
                >
                  <Icon name={copiedKey === 'phone' ? 'check' : 'copy'} size={13} />
                  <span>{copiedKey === 'phone' ? 'Tersalin' : 'Salin'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Help Information */}
        <div className="space-y-3">
          <h4 className="text-[13px] font-semibold text-ink">Panduan Cepat & Bantuan</h4>

          <div className="space-y-2 text-xs leading-relaxed text-ink-muted">
            <div className="flex items-start gap-2.5 rounded-[9px] border border-line bg-surface p-3">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface-2 text-primary">
                <Icon name="database" size={12} />
              </span>
              <div>
                <p className="font-medium text-ink">Penyimpanan Lokal Mandiri</p>
                <p className="mt-0.5">
                  Seluruh wawancara, narasumber, coding, dan analisis tersimpan di IndexedDB browser lokal Anda. Tidak ada data yang diunggah ke peladen pihak ketiga.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2.5 rounded-[9px] border border-line bg-surface p-3">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface-2 text-primary">
                <Icon name="download" size={12} />
              </span>
              <div>
                <p className="font-medium text-ink">Pencadangan Rutin</p>
                <p className="mt-0.5">
                  Unduh berkas cadangan JSON secara berkala melalui menu Pengaturan agar data tetap aman bila riwayat browser dibersihkan.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2.5 rounded-[9px] border border-line bg-surface p-3">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface-2 text-primary">
                <Icon name="alert" size={12} />
              </span>
              <div>
                <p className="font-medium text-ink">Pelaporan Bug atau Kendala</p>
                <p className="mt-0.5">
                  Jika menemukan kekeliruan sistem atau ingin mengusulkan fitur baru, silakan hubungi kontak pengembang di atas atau sampaikan lewat GitHub.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  )
}
