import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

/**
 * Mencegah satu kesalahan render menghapus seluruh antarmuka. Data tetap berada
 * di IndexedDB; pengguna diberi jalan memuat ulang atau membuka halaman backup.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Simpan detail ke konsol agar dapat diperiksa tanpa mengirim data ke mana pun.
    console.error('Kesalahan antarmuka Interview Workspace:', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas px-4 py-10">
        <div className="w-full max-w-lg rounded-[12px] border border-line bg-surface p-6 shadow-[0_20px_50px_-30px_rgba(20,35,26,0.45)]">
          <p className="mono-meta uppercase text-danger">Kesalahan antarmuka</p>
          <h1 className="mt-2 text-[20px] font-semibold tracking-[-0.01em] text-ink">
            Halaman ini gagal ditampilkan
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">
            Data yang sudah tersimpan di perangkat tidak dihapus. Muat ulang halaman untuk melanjutkan. Jika masalah
            berulang, buka Pengaturan dan unduh backup JSON sebelum membersihkan data browser.
          </p>
          <pre className="mt-3 max-h-32 overflow-auto rounded-[8px] border border-line bg-surface-2 p-2.5 text-[11px] leading-relaxed text-ink-muted">
            {this.state.error.message}
          </pre>
          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex min-h-10 items-center justify-center rounded-[8px] bg-primary px-3.5 text-sm font-medium text-primary-ink"
            >
              Muat ulang halaman
            </button>
            <a
              href="#/pengaturan"
              onClick={() => this.setState({ error: null })}
              className="inline-flex min-h-10 items-center justify-center rounded-[8px] border border-line-strong bg-surface px-3.5 text-sm font-medium text-ink"
            >
              Buka Pengaturan
            </a>
          </div>
        </div>
      </div>
    )
  }
}
