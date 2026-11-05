import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type RefObject,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import { createPortal } from 'react-dom'
import { Icon, type IconName } from './Icon'
import type { SaveState } from '../lib/store'

export function cx(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ')
}

/* ------------------------------------------------------------------ */
/* Buttons                                                             */
/* ------------------------------------------------------------------ */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'quiet' | 'danger'
type ButtonSize = 'sm' | 'md'

export function buttonClasses(variant: ButtonVariant = 'secondary', size: ButtonSize = 'md', className?: string): string {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-[9px] font-medium transition-[background-color,border-color,color,box-shadow] duration-150 ease-out disabled:cursor-not-allowed disabled:opacity-50 select-none'
  const sizes = size === 'sm' ? 'h-9 px-3 text-[13px] max-sm:h-11' : 'h-10 px-3.5 text-sm max-sm:h-11'
  const variants: Record<ButtonVariant, string> = {
    primary: 'bg-primary text-primary-ink hover:bg-primary-hover shadow-[0_1px_0_rgba(0,0,0,0.06)]',
    secondary: 'border border-line-strong bg-surface text-ink hover:bg-surface-2 hover:border-ink-muted',
    ghost: 'text-ink-soft hover:bg-surface-2 hover:text-ink',
    quiet: 'text-primary hover:bg-primary-soft',
    danger: 'bg-danger text-danger-ink hover:opacity-90',
  }
  return cx(base, sizes, variants[variant], className)
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  icon?: IconName
  iconRight?: IconName
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'secondary', size = 'md', icon, iconRight, className, children, ...props }, ref) => {
    return (
      <button ref={ref} type="button" className={buttonClasses(variant, size, className)} {...props}>
        {icon ? <Icon name={icon} size={16} /> : null}
        {children}
        {iconRight ? <Icon name={iconRight} size={16} /> : null}
      </button>
    )
  },
)
Button.displayName = 'Button'

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string
  icon: IconName
  variant?: 'ghost' | 'secondary' | 'quiet'
  size?: 'sm' | 'md'
  danger?: boolean
}

export function IconButton({ label, icon, variant = 'ghost', size = 'md', danger, className, ...props }: IconButtonProps) {
  const dimension = size === 'sm' ? 'h-8 w-8 max-sm:h-11 max-sm:w-11' : 'h-10 w-10 max-sm:h-11 max-sm:w-11'
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cx(
        'inline-flex shrink-0 items-center justify-center rounded-lg transition-colors duration-150',
        dimension,
        danger
          ? 'text-danger hover:bg-danger-soft'
          : variant === 'secondary'
            ? 'border border-line-strong bg-surface text-ink-soft hover:bg-surface-2 hover:text-ink'
            : variant === 'quiet'
              ? 'text-primary hover:bg-primary-soft'
              : 'text-ink-muted hover:bg-surface-2 hover:text-ink',
        className,
      )}
      {...props}
    >
      <Icon name={icon} size={size === 'sm' ? 15 : 18} />
    </button>
  )
}

/* ------------------------------------------------------------------ */
/* Form controls                                                       */
/* ------------------------------------------------------------------ */

const controlBase =
  'w-full rounded-[9px] border border-line-strong bg-surface text-ink transition-[border-color,box-shadow] duration-150 placeholder:text-ink-muted disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-ink-muted'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(
  ({ className, invalid, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cx(
          controlBase,
          'h-11 px-3 text-[15px]',
          invalid ? 'border-danger focus:border-danger' : 'focus:border-primary',
          'focus:shadow-[0_0_0_3px_var(--primary-soft)] focus:outline-none',
          className,
        )}
        aria-invalid={invalid || undefined}
        {...props}
      />
    )
  },
)
Input.displayName = 'Input'

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }>(
  ({ className, invalid, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cx(
          controlBase,
          'min-h-24 resize-y px-3 py-2.5 text-[15px] leading-relaxed',
          invalid ? 'border-danger focus:border-danger' : 'focus:border-primary',
          'focus:shadow-[0_0_0_3px_var(--primary-soft)] focus:outline-none',
          className,
        )}
        aria-invalid={invalid || undefined}
        {...props}
      />
    )
  },
)
Textarea.displayName = 'Textarea'

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }>(
  ({ className, invalid, children, ...props }, ref) => {
    return (
      <div className="relative">
        <select
          ref={ref}
          className={cx(
            controlBase,
            'h-11 appearance-none pl-3 pr-9 text-[15px]',
            invalid ? 'border-danger focus:border-danger' : 'focus:border-primary',
            'focus:shadow-[0_0_0_3px_var(--primary-soft)] focus:outline-none',
            className,
          )}
          aria-invalid={invalid || undefined}
          {...props}
        >
          {children}
        </select>
        <Icon
          name="chevronDown"
          size={16}
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted"
        />
      </div>
    )
  },
)
Select.displayName = 'Select'

interface FieldProps {
  label: string
  htmlFor: string
  hint?: string
  error?: string
  required?: boolean
  optional?: boolean
  children: ReactNode
  className?: string
}

export function Field({ label, htmlFor, hint, error, required, optional, children, className }: FieldProps) {
  return (
    <div className={cx('space-y-1.5', className)}>
      <label htmlFor={htmlFor} className="flex items-baseline gap-1.5 text-[13px] font-medium text-ink">
        {label}
        {required ? (
          <span className="text-accent" aria-hidden="true">
            *
          </span>
        ) : null}
        {optional ? <span className="text-[11px] font-normal text-ink-muted">(opsional)</span> : null}
      </label>
      {children}
      {hint && !error ? (
        <p id={`${htmlFor}-hint`} className="text-xs leading-relaxed text-ink-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${htmlFor}-error`} className="flex items-start gap-1.5 text-xs leading-relaxed text-danger" role="alert">
          <Icon name="alert" size={13} className="mt-0.5 shrink-0" />
          {error}
        </p>
      ) : null}
    </div>
  )
}

export function Checkbox({
  label,
  description,
  className,
  id,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode; description?: string }) {
  const generated = useId()
  const inputId = id ?? generated
  return (
    <div className={cx('flex items-start gap-2.5', className)}>
      <input
        id={inputId}
        type="checkbox"
        className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded-[4px] border-line-strong text-primary accent-[var(--primary)]"
        {...props}
      />
      <label htmlFor={inputId} className="cursor-pointer text-sm leading-snug text-ink">
        {label}
        {description ? <span className="mt-0.5 block text-xs text-ink-muted">{description}</span> : null}
      </label>
    </div>
  )
}

export function Switch({ checked, onChange, label, description, id }: { checked: boolean; onChange: (value: boolean) => void; label: string; description?: string; id?: string }) {
  const generated = useId()
  const switchId = id ?? generated
  return (
    <div className="flex items-start justify-between gap-4 py-1">
      <div>
        <label htmlFor={switchId} className="cursor-pointer text-sm font-medium text-ink">
          {label}
        </label>
        {description ? <p className="mt-0.5 text-xs text-ink-muted">{description}</p> : null}
      </div>
      <button
        id={switchId}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cx(
          'relative mt-0.5 h-6 w-11 shrink-0 rounded-full border transition-colors duration-150',
          checked ? 'border-primary bg-primary' : 'border-line-strong bg-surface-3',
        )}
      >
        <span
          className={cx(
            'absolute top-0.5 h-4.5 w-4.5 rounded-full bg-white shadow-sm transition-[left] duration-150 ease-out',
            checked ? 'left-[calc(100%-1.25rem)]' : 'left-0.5',
          )}
          style={{ height: 18, width: 18, backgroundColor: checked ? 'var(--primary-ink)' : 'var(--surface)' }}
        />
        <span className="sr-only">{checked ? 'Aktif' : 'Nonaktif'}</span>
      </button>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Badges, progress, misc                                              */
/* ------------------------------------------------------------------ */

type Tone = 'neutral' | 'primary' | 'success' | 'warn' | 'danger' | 'info' | 'accent'

const toneClasses: Record<Tone, string> = {
  neutral: 'bg-surface-2 text-ink-soft border-line',
  primary: 'bg-primary-soft text-primary border-transparent',
  success: 'bg-success-soft text-success border-transparent',
  warn: 'bg-warn-soft text-warn border-transparent',
  danger: 'bg-danger-soft text-danger border-transparent',
  info: 'bg-info-soft text-info border-transparent',
  accent: 'bg-accent-soft text-accent border-transparent',
}

export function Badge({ tone = 'neutral', children, className, dot }: { tone?: Tone; children: ReactNode; className?: string; dot?: boolean }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 rounded-[5px] border px-2 py-0.5 text-[11px] font-medium leading-5 whitespace-nowrap',
        toneClasses[tone],
        className,
      )}
    >
      {dot ? <span className={cx('h-1.5 w-1.5 rounded-full', tone === 'neutral' ? 'bg-ink-muted' : 'bg-current')} aria-hidden="true" /> : null}
      {children}
    </span>
  )
}

const statusTones: Record<string, Tone> = {
  'Belum Dijawab': 'neutral',
  Terisi: 'success',
  'Perlu Klarifikasi': 'warn',
  Ditinjau: 'info',
  Draft: 'neutral',
  Berlangsung: 'primary',
  'Perlu Ditinjau': 'warn',
  Selesai: 'success',
  Diarsipkan: 'neutral',
  Persiapan: 'neutral',
  Analisis: 'info',
  Berhasil: 'success',
  Gagal: 'danger',
  'Tidak terbaca': 'warn',
  tinggi: 'success',
  sedang: 'warn',
  rendah: 'neutral',
}

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const tone = statusTones[status] ?? 'neutral'
  return (
    <Badge tone={tone} dot className={className}>
      {status}
    </Badge>
  )
}

export function Progress({ value, tone = 'primary', className, label }: { value: number; tone?: 'primary' | 'success' | 'accent'; className?: string; label?: string }) {
  const clamped = Math.max(0, Math.min(100, value))
  const color = tone === 'success' ? 'bg-success' : tone === 'accent' ? 'bg-accent' : 'bg-primary'
  return (
    <div
      className={cx('h-1.5 w-full overflow-hidden rounded-full bg-surface-3', className)}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={clamped}
      aria-label={label ?? 'Progres'}
    >
      <div className={cx('h-full rounded-full transition-[width] duration-300 ease-out', color)} style={{ width: `${clamped}%` }} />
    </div>
  )
}

export function Spinner({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={cx('animate-spin', className)} aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity="0.2" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx('animate-pulse rounded-md bg-surface-3', className)} aria-hidden="true" />
}

export function SaveIndicator({ state, onRetry, className }: { state: SaveState; onRetry?: () => void; className?: string }) {
  return (
    <span className={cx('inline-flex min-h-6 items-center gap-1.5 text-xs', className)} aria-live="polite">
      {state === 'saving' ? (
        <>
          <Spinner size={12} className="text-ink-muted" />
          <span className="text-ink-muted">Menyimpan…</span>
        </>
      ) : state === 'saved' ? (
        <>
          <Icon name="checkCircle" size={13} className="text-success" />
          <span className="text-ink-muted">Tersimpan di perangkat</span>
        </>
      ) : state === 'error' ? (
        <>
          <Icon name="alert" size={13} className="text-danger" />
          <span className="text-danger">Gagal menyimpan</span>
          {onRetry ? (
            <button type="button" onClick={onRetry} className="font-medium text-danger underline underline-offset-2">
              Coba lagi
            </button>
          ) : null}
        </>
      ) : (
        <span className="text-ink-muted">Perubahan tersimpan otomatis</span>
      )}
    </span>
  )
}

export function InlineNotice({
  tone = 'info',
  title,
  children,
  action,
  className,
}: {
  tone?: 'info' | 'warn' | 'danger' | 'success'
  title?: string
  children: ReactNode
  action?: ReactNode
  className?: string
}) {
  const styles = {
    info: { box: 'border-line bg-surface', icon: 'text-info', name: 'info' as IconName },
    warn: { box: 'border-warn/30 bg-warn-soft', icon: 'text-warn', name: 'alert' as IconName },
    danger: { box: 'border-danger/30 bg-danger-soft', icon: 'text-danger', name: 'alert' as IconName },
    success: { box: 'border-success/30 bg-success-soft', icon: 'text-success', name: 'checkCircle' as IconName },
  }[tone]
  return (
    <div className={cx('flex gap-3 rounded-[10px] border px-3.5 py-3', styles.box, className)}>
      <Icon name={styles.name} size={17} className={cx('mt-0.5 shrink-0', styles.icon)} />
      <div className="min-w-0 flex-1 text-sm leading-relaxed text-ink-soft">
        {title ? <p className="mb-0.5 font-semibold text-ink">{title}</p> : null}
        {children}
      </div>
      {action ? <div className="shrink-0 self-center">{action}</div> : null}
    </div>
  )
}

export function EmptyState({
  icon = 'folder',
  title,
  description,
  action,
  className,
}: {
  icon?: IconName
  title: string
  description: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cx('flex flex-col items-center justify-center rounded-[12px] border border-dashed border-line-strong bg-surface/60 px-5 py-12 text-center', className)}>
      <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-primary-soft text-primary">
        <Icon name={icon} size={20} />
      </span>
      <h3 className="text-[15px] font-semibold text-ink">{title}</h3>
      <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-ink-muted">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Modal, drawer, confirm                                              */
/* ------------------------------------------------------------------ */

function useLockBody(active: boolean) {
  useEffect(() => {
    if (!active) return
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = original
    }
  }, [active])
}

function useDismissable(
  open: boolean,
  onClose: () => void,
  panelRef: RefObject<HTMLElement | null>,
  initialFocusRef?: RefObject<HTMLElement | null>,
) {
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  const hasFocusedRef = useRef(false)

  useEffect(() => {
    if (!open) {
      hasFocusedRef.current = false
      return
    }

    if (hasFocusedRef.current) return
    hasFocusedRef.current = true

    const previous = document.activeElement as HTMLElement | null
    const timer = window.setTimeout(() => {
      if (initialFocusRef?.current) {
        initialFocusRef.current.focus()
        return
      }

      const panel = panelRef.current
      if (!panel) return

      // Prioritize explicit autofocus
      const explicitAuto = panel.querySelector<HTMLElement>('[autofocus]')
      if (explicitAuto) {
        explicitAuto.focus()
        return
      }

      // Prioritize inputs/textareas/selects inside the modal content/body, NOT the header close button!
      const formInput = panel.querySelector<HTMLElement>(
        '.modal-body input:not([disabled]):not([type="hidden"]), .modal-body textarea:not([disabled]), .modal-body select:not([disabled]), form input:not([disabled]):not([type="hidden"]), form textarea:not([disabled]), form select:not([disabled])',
      )
      if (formInput) {
        formInput.focus()
        return
      }

      // Any interactive element inside content
      const firstContentAction = panel.querySelector<HTMLElement>(
        '.modal-body button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled])',
      )

      ;(firstContentAction ?? panel).focus()
    }, 40)

    return () => {
      window.clearTimeout(timer)
      previous?.focus?.()
    }
  }, [open, panelRef, initialFocusRef])

  useEffect(() => {
    if (!open) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab') return
      const panel = panelRef.current
      if (!panel) return
      const nodes = Array.from(
        panel.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((node) => node.offsetParent !== null || node === document.activeElement)
      if (nodes.length === 0) {
        event.preventDefault()
        panel.focus()
        return
      }
      const first = nodes[0]
      const last = nodes[nodes.length - 1]
      if (event.shiftKey && (document.activeElement === first || document.activeElement === panel)) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open, panelRef])
}

function usePresence(open: boolean, duration: number) {
  const [mounted, setMounted] = useState(open)
  const [closing, setClosing] = useState(false)
  useEffect(() => {
    if (open) {
      setMounted(true)
      setClosing(false)
      return
    }
    if (!mounted) return
    setClosing(true)
    const timer = window.setTimeout(() => {
      setMounted(false)
      setClosing(false)
    }, duration)
    return () => window.clearTimeout(timer)
  }, [open, mounted, duration])
  return { mounted, closing }
}

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  children: ReactNode
  footer?: ReactNode
  initialFocusRef?: React.RefObject<HTMLElement | null>
  preventClose?: boolean
}

export function Modal({ open, onClose, title, description, size = 'md', children, footer, initialFocusRef, preventClose }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const descriptionId = useId()
  const { mounted, closing } = usePresence(open, 150)
  useLockBody(mounted)

  const handleClose = useCallback(() => {
    if (!preventClose) onClose()
  }, [preventClose, onClose])

  useDismissable(mounted && !closing, handleClose, panelRef, initialFocusRef)

  if (!mounted) return null

  const maxWidth = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl', xl: 'max-w-5xl' }[size]

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-6">
      <div
        className={cx('absolute inset-0 bg-slate-950/45 backdrop-blur-[2px]', closing ? 'animate-overlay-out' : 'animate-overlay-in')}
        onClick={handleClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={cx(
          'relative flex max-h-[92dvh] w-full flex-col overflow-hidden border border-line bg-surface shadow-[0_24px_70px_-15px_rgba(15,23,42,0.22)] dark:shadow-[0_24px_70px_-15px_rgba(0,0,0,0.6)] outline-none',
          'rounded-t-2xl sm:rounded-2xl',
          maxWidth,
          closing ? 'animate-panel-out' : 'animate-panel-in',
        )}
      >
        <div className="flex items-start gap-4 border-b border-line px-5 py-4 sm:px-6">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-base font-semibold leading-snug text-ink sm:text-lg">
              {title}
            </h2>
            {description ? (
              <p id={descriptionId} className="mt-1 text-[13px] leading-relaxed text-ink-muted">
                {description}
              </p>
            ) : null}
          </div>
          <IconButton label="Tutup" icon="x" onClick={handleClose} className="-mr-1 -mt-1" />
        </div>
        <div className="modal-body min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
        {footer ? <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line bg-surface-2/60 px-5 py-3.5 sm:px-6">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  )
}

interface DrawerProps {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
  width?: 'md' | 'lg'
  initialFocusRef?: React.RefObject<HTMLElement | null>
}

export function Drawer({ open, onClose, title, description, children, footer, width = 'md', initialFocusRef }: DrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const { mounted, closing } = usePresence(open, 200)
  useLockBody(mounted)
  useDismissable(mounted && !closing, onClose, panelRef, initialFocusRef)

  if (!mounted) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className={cx('absolute inset-0 bg-slate-950/45 backdrop-blur-[2px]', closing ? 'animate-overlay-out' : 'animate-overlay-in')}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cx(
          'relative flex h-full w-full flex-col border-l border-line bg-surface shadow-[-24px_0_60px_-30px_rgba(15,23,42,0.35)] dark:shadow-[-24px_0_60px_-30px_rgba(0,0,0,0.6)] outline-none',
          width === 'lg' ? 'sm:max-w-xl' : 'sm:max-w-md',
          closing ? 'animate-drawer-out' : 'animate-drawer-in',
        )}
      >
        <div className="flex items-start gap-4 border-b border-line px-5 py-4">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-base font-semibold text-ink">
              {title}
            </h2>
            {description ? <p className="mt-0.5 text-[13px] text-ink-muted">{description}</p> : null}
          </div>
          <IconButton label="Tutup" icon="x" onClick={onClose} className="-mr-1 -mt-1" />
        </div>
        <div className="modal-body min-h-0 flex-1 overflow-y-auto px-5 py-5">{children}</div>
        {footer ? <div className="safe-bottom flex items-center justify-end gap-2 border-t border-line px-5 py-3.5">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  )
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  impact,
  confirmLabel = 'Hapus',
  tone = 'danger',
  busy,
}: {
  open: boolean
  onClose: () => void
  onConfirm: () => void | Promise<void>
  title: string
  description: string
  impact?: string
  confirmLabel?: string
  tone?: 'danger' | 'primary'
  busy?: boolean
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size="sm"
      preventClose={busy}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Batal
          </Button>
          <Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={() => void onConfirm()} disabled={busy}>
            {busy ? <Spinner size={15} /> : null}
            {confirmLabel}
          </Button>
        </>
      }
    >
      {impact ? (
        <div className="rounded-[10px] border border-line bg-surface-2 px-4 py-3 text-sm leading-relaxed text-ink-soft">
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-ink-muted">Dampak</span>
          {impact}
        </div>
      ) : null}
    </Modal>
  )
}

/* ------------------------------------------------------------------ */
/* Toast                                                               */
/* ------------------------------------------------------------------ */

type ToastTone = 'success' | 'error' | 'info'
interface ToastItem {
  id: number
  message: string
  tone: ToastTone
}

interface ToastContextValue {
  notify: (message: string, tone?: ToastTone) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast harus dipakai di dalam ToastProvider')
  return ctx
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const counter = useRef(0)

  const remove = useCallback((id: number) => {
    setItems((prev) => prev.filter((item) => item.id !== id))
  }, [])

  const notify = useCallback(
    (message: string, tone: ToastTone = 'success') => {
      counter.current += 1
      const id = counter.current
      setItems((prev) => [...prev.slice(-2), { id, message, tone }])
      window.setTimeout(() => remove(id), 4500)
    },
    [remove],
  )

  const value = useMemo(() => ({ notify }), [notify])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-4 bottom-4 z-[70] flex flex-col items-center gap-2 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:items-end">
        <div aria-live="polite" className="flex w-full max-w-sm flex-col gap-2">
          {items.map((item) => (
            <div
              key={item.id}
              className="animate-toast-in pointer-events-auto flex items-start gap-2.5 rounded-[10px] border border-line bg-surface px-3.5 py-3 shadow-[0_12px_36px_-14px_rgba(15,25,20,0.45)]"
            >
              <Icon
                name={item.tone === 'success' ? 'checkCircle' : item.tone === 'error' ? 'alert' : 'info'}
                size={17}
                className={cx('mt-0.5 shrink-0', item.tone === 'success' ? 'text-success' : item.tone === 'error' ? 'text-danger' : 'text-info')}
              />
              <p className="min-w-0 flex-1 text-sm leading-snug text-ink">{item.message}</p>
              <button
                type="button"
                onClick={() => remove(item.id)}
                aria-label="Tutup notifikasi"
                className="-mr-1 -mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-ink-muted hover:bg-surface-2 hover:text-ink"
              >
                <Icon name="x" size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </ToastContext.Provider>
  )
}

/* ------------------------------------------------------------------ */
/* Tabs                                                                */
/* ------------------------------------------------------------------ */

export interface TabItem {
  id: string
  label: string
  count?: number
}

export function Tabs({ items, value, onChange, label, className }: { items: TabItem[]; value: string; onChange: (id: string) => void; label: string; className?: string }) {
  const listRef = useRef<HTMLDivElement>(null)
  const onKeyDown = (event: ReactKeyboardEvent, index: number) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft' && event.key !== 'Home' && event.key !== 'End') return
    event.preventDefault()
    let next = index
    if (event.key === 'ArrowRight') next = (index + 1) % items.length
    if (event.key === 'ArrowLeft') next = (index - 1 + items.length) % items.length
    if (event.key === 'Home') next = 0
    if (event.key === 'End') next = items.length - 1
    onChange(items[next].id)
    const buttons = listRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
    buttons?.[next]?.focus()
  }

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={label}
      className={cx('flex gap-1 overflow-x-auto border-b border-line pb-px', className)}
    >
      {items.map((item, index) => {
        const active = item.id === value
        return (
          <button
            key={item.id}
            role="tab"
            type="button"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(item.id)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={cx(
              'relative inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-t-md px-3 text-[13px] font-medium transition-colors duration-150',
              active ? 'text-primary' : 'text-ink-muted hover:bg-surface-2 hover:text-ink',
            )}
          >
            {item.label}
            {item.count !== undefined ? (
              <span className={cx('mono-meta rounded px-1.5 py-0.5 text-[10px]', active ? 'bg-primary-soft text-primary' : 'bg-surface-2 text-ink-muted')}>
                {item.count}
              </span>
            ) : null}
            {active ? <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-primary" aria-hidden="true" /> : null}
          </button>
        )
      })}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Page header + search                                                */
/* ------------------------------------------------------------------ */

export function PageHeader({
  breadcrumb,
  title,
  description,
  meta,
  actions,
}: {
  breadcrumb?: ReactNode
  title: string
  description?: string
  meta?: ReactNode
  actions?: ReactNode
}) {
  return (
    <header className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        {breadcrumb ? <div className="mb-2 flex flex-wrap items-center gap-1.5 text-xs text-ink-muted">{breadcrumb}</div> : null}
        <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-ink sm:text-[27px]">{title}</h1>
        {description ? <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-ink-soft">{description}</p> : null}
        {meta ? <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs text-ink-muted">{meta}</div> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2 sm:justify-end">{actions}</div> : null}
    </header>
  )
}

export function SearchInput({
  value,
  onChange,
  placeholder = 'Cari…',
  label = 'Cari',
  className,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  label?: string
  className?: string
}) {
  const id = useId()
  return (
    <div className={cx('relative', className)}>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <Icon name="search" size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
      <input
        id={id}
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={cx(controlBase, 'h-10 pl-9 text-sm max-sm:h-11', value ? 'pr-9' : 'pr-3', 'focus:border-primary focus:shadow-[0_0_0_3px_var(--primary-soft)] focus:outline-none')}
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Hapus pencarian"
          className="absolute right-1.5 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-ink-muted hover:bg-surface-2 hover:text-ink"
        >
          <Icon name="x" size={14} />
        </button>
      ) : null}
    </div>
  )
}

export function DataRow({ children, className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cx('flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line px-4 py-3 last:border-b-0', className)} {...props}>
      {children}
    </div>
  )
}

export function MetaLabel({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cx('mono-meta text-ink-muted', className)}>{children}</span>
}
