import { Link } from 'react-router-dom'
import { usePageTitle } from '../lib/hooks'
import { Button, EmptyState } from '../components/ui'

export function NotFound() {
  usePageTitle('Halaman tidak ditemukan')

  return (
    <div className="mx-auto max-w-2xl py-6 sm:py-12">
      <p className="mono-meta text-center uppercase text-accent">404</p>
      <EmptyState
        className="mt-3"
        icon="search"
        title="Halaman tidak ditemukan"
        description="Alamat ini tidak tersedia atau sudah berubah. Kembali ke dasbor untuk memilih proyek, atau buka Pengaturan bila Anda mencari cadangan data."
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Link to="/">
              <Button variant="primary" icon="arrowLeft">
                Kembali ke dasbor
              </Button>
            </Link>
            <Link to="/pengaturan">
              <Button variant="secondary" icon="settings">
                Buka Pengaturan
              </Button>
            </Link>
          </div>
        }
      />
      <p className="mt-4 text-center text-[11px] leading-relaxed text-ink-muted">
        Tautan proyek memuat nomor proyek. Jika proyek sudah dihapus, data tidak dapat dipulihkan tanpa file cadangan.
      </p>
    </div>
  )
}
