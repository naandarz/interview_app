import { Icon } from './Icon'
import { cx } from './ui'

interface AppFooterProps {
  onOpenHelp?: () => void
  className?: string
}

export function AppFooter({ onOpenHelp, className }: AppFooterProps) {
  return (
    <footer
      className={cx(
        'mt-auto border-t border-line bg-surface/60 py-6 text-xs text-ink-muted transition-colors',
        className,
      )}
    >
      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-4 px-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <div className="flex flex-col gap-1 sm:max-w-md">
          <div className="flex items-center gap-2 text-ink">
            <span className="flex h-5 w-5 items-center justify-center rounded bg-primary text-primary-ink">
              <Icon name="guide" size={12} />
            </span>
            <span className="font-semibold tracking-tight text-[13px]">Interview Workspace</span>
            <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] font-mono text-ink-muted">v1.0</span>
          </div>
          <p className="text-[12px] leading-relaxed text-ink-muted">
            Ruang kerja wawancara kualitatif lokal. Data Anda tersimpan sepenuhnya di perangkat.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex items-center gap-1.5 text-[12px] text-ink-soft">
            <span className="text-ink-muted">Pengembang:</span>
            <a
              href="https://github.com/naandarz"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-medium text-ink hover:text-primary transition-colors"
            >
              <Icon name="github" size={14} />
              <span>naandarz</span>
            </a>
          </div>

          <span className="hidden h-3.5 w-px bg-line sm:block" aria-hidden="true" />

          <a
            href="mailto:nndarz03@gmail.com"
            className="inline-flex items-center gap-1 text-[12px] text-ink-soft hover:text-primary transition-colors"
            title="Kirim email ke developer"
          >
            <Icon name="mail" size={13} className="text-ink-muted" />
            <span>nndarz03@gmail.com</span>
          </a>

          <span className="hidden h-3.5 w-px bg-line sm:block" aria-hidden="true" />

          <a
            href="https://wa.me/6285601689713"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[12px] text-ink-soft hover:text-success transition-colors"
            title="Chat WhatsApp developer"
          >
            <Icon name="phone" size={13} className="text-ink-muted" />
            <span>085601689713</span>
          </a>

          {onOpenHelp ? (
            <>
              <span className="hidden h-3.5 w-px bg-line sm:block" aria-hidden="true" />
              <button
                type="button"
                onClick={onOpenHelp}
                className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-medium text-primary hover:bg-primary-soft transition-colors"
              >
                <Icon name="help" size={14} />
                <span>Bantuan & Kontak</span>
              </button>
            </>
          ) : null}
        </div>
      </div>
    </footer>
  )
}
