import type { ReactNode, SVGProps } from 'react'

export type IconName =
  | 'overview'
  | 'folder'
  | 'document'
  | 'guide'
  | 'people'
  | 'session'
  | 'data'
  | 'analysis'
  | 'export'
  | 'settings'
  | 'plus'
  | 'search'
  | 'x'
  | 'check'
  | 'checkCircle'
  | 'alert'
  | 'info'
  | 'chevronDown'
  | 'chevronLeft'
  | 'chevronRight'
  | 'arrowLeft'
  | 'arrowRight'
  | 'edit'
  | 'trash'
  | 'archive'
  | 'copy'
  | 'grip'
  | 'menu'
  | 'sun'
  | 'moon'
  | 'monitor'
  | 'upload'
  | 'file'
  | 'download'
  | 'clock'
  | 'calendar'
  | 'quote'
  | 'tag'
  | 'layers'
  | 'link'
  | 'external'
  | 'filter'
  | 'refresh'
  | 'note'
  | 'target'
  | 'book'
  | 'flag'
  | 'user'
  | 'lock'
  | 'database'
  | 'save'

interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: IconName
  size?: number
}

export function Icon({ name, size = 18, strokeWidth = 1.7, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {paths[name]}
    </svg>
  )
}

const paths: Record<IconName, ReactNode> = {
  overview: (
    <>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.2" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.2" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.2" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.2" />
    </>
  ),
  folder: <path d="M3.5 7.2c0-1 .8-1.7 1.7-1.7h3.4l1.8 2h8.4c1 0 1.7.8 1.7 1.7v8.1c0 1-.8 1.7-1.7 1.7H5.2c-1 0-1.7-.8-1.7-1.7V7.2Z" />,
  document: (
    <>
      <path d="M6 3.5h7l5 5v12H6z" />
      <path d="M13 3.5v5h5" />
      <path d="M9 13h6M9 16.5h6" />
    </>
  ),
  guide: (
    <>
      <path d="M4 5.5h6.5A2.5 2.5 0 0 1 13 8v11.5a2 2 0 0 0-2-2H4z" />
      <path d="M20 5.5h-6.5A2.5 2.5 0 0 0 11 8v11.5a2 2 0 0 1 2-2h7z" />
    </>
  ),
  people: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 19.5c0-3 2.5-5 5.5-5s5.5 2 5.5 5" />
      <path d="M16 5.4a2.8 2.8 0 0 1 0 5.4M17.5 14.8c1.9.5 3.2 2.2 3.2 4.4" />
    </>
  ),
  session: (
    <>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3M8.5 21h7" />
    </>
  ),
  data: (
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="1.5" />
      <path d="M3.5 9.5h17M9 9.5v10M15 9.5v10M3.5 14.5h17" />
    </>
  ),
  analysis: (
    <>
      <path d="M4 20V4M4 20h16" />
      <path d="M8 16.5v-4M12.5 16.5V8M17 16.5v-6.5" />
    </>
  ),
  export: (
    <>
      <path d="M12 3.5v11M8 6.5l4-3 4 3" />
      <path d="M4.5 14v5.5a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5V14" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 14.2a7.8 7.8 0 0 0 0-4.4l1.6-1.2-2-3.4-1.9.8a7.7 7.7 0 0 0-3.8-2.2L13 1.8h-4l-.3 2a7.7 7.7 0 0 0-3.8 2.2l-1.9-.8-2 3.4 1.6 1.2a7.8 7.8 0 0 0 0 4.4l-1.6 1.2 2 3.4 1.9-.8a7.7 7.7 0 0 0 3.8 2.2l.3 2h4l.3-2a7.7 7.7 0 0 0 3.8-2.2l1.9.8 2-3.4z" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </>
  ),
  x: <path d="m6 6 12 12M18 6 6 18" />,
  check: <path d="m4.5 12.5 5 5 10-11" />,
  checkCircle: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m8 12.2 2.7 2.7L16 9.3" />
    </>
  ),
  alert: (
    <>
      <path d="M12 3.8 21 20H3z" />
      <path d="M12 9v5M12 17.2v.2" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5.5M12 7.8v.2" />
    </>
  ),
  chevronDown: <path d="m6 9.5 6 6 6-6" />,
  chevronLeft: <path d="m14.5 6-6 6 6 6" />,
  chevronRight: <path d="m9.5 6 6 6-6 6" />,
  arrowLeft: <path d="M20 12H4M10 6l-6 6 6 6" />,
  arrowRight: <path d="M4 12h16M14 6l6 6-6 6" />,
  edit: (
    <>
      <path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17z" />
      <path d="m14.5 6.5 3 3" />
    </>
  ),
  trash: (
    <>
      <path d="M4.5 6.5h15M9 6.5V4h6v2.5M6.5 6.5l.8 13a1.5 1.5 0 0 0 1.5 1.4h6.4a1.5 1.5 0 0 0 1.5-1.4l.8-13" />
      <path d="M10 10.5v6M14 10.5v6" />
    </>
  ),
  archive: (
    <>
      <rect x="3.5" y="4" width="17" height="4" rx="1" />
      <path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8M10 12h4" />
    </>
  ),
  copy: (
    <>
      <rect x="8.5" y="8.5" width="11" height="11" rx="1.5" />
      <path d="M15.5 8.5v-3a1 1 0 0 0-1-1h-10a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" />
    </>
  ),
  grip: (
    <>
      <circle cx="9" cy="6" r="1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="6" r="1" fill="currentColor" stroke="none" />
      <circle cx="9" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="9" cy="18" r="1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="18" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.8v2M12 19.2v2M4.5 4.5 6 6M18 18l1.5 1.5M2.8 12h2M19.2 12h2M4.5 19.5 6 18M18 6l1.5-1.5" />
    </>
  ),
  moon: <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" />,
  monitor: (
    <>
      <rect x="3" y="4.5" width="18" height="12" rx="1.5" />
      <path d="M9 20h6M12 16.5V20" />
    </>
  ),
  upload: (
    <>
      <path d="M4 16.5v3h16v-3" />
      <path d="M12 16V3M7.5 7.5 12 3l4.5 4.5" />
    </>
  ),
  file: (
    <>
      <path d="M6 3.5h7l5 5v12H6z" />
      <path d="M13 3.5v5h5" />
    </>
  ),
  download: (
    <>
      <path d="M12 3.5v11M7.5 10.5 12 15l4.5-4.5" />
      <path d="M4.5 15v4.5a1 1 0 0 0 1 1h13a1 1 0 0 0 1-1V15" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7v5.4l3.4 2" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="1.5" />
      <path d="M3.5 9.5h17M8 3v4M16 3v4" />
    </>
  ),
  quote: (
    <>
      <path d="M9.5 6.5C6.5 8 5 10.5 5 14v3.5h5.5V12H7.4c.1-1.8.8-3 2.1-3.9zM19.5 6.5C16.5 8 15 10.5 15 14v3.5h5.5V12h-3.1c.1-1.8.8-3 2.1-3.9z" />
    </>
  ),
  tag: (
    <>
      <path d="M3.5 11.5V4.5h7l10 10-7 7z" />
      <circle cx="7.8" cy="8" r="1.3" />
    </>
  ),
  layers: (
    <>
      <path d="m12 3.5 8 4.5-8 4.5-8-4.5z" />
      <path d="m4 12.5 8 4.5 8-4.5M4 16.5l8 4.5 8-4.5" />
    </>
  ),
  link: (
    <>
      <path d="M10.5 13.5a4 4 0 0 0 5.7 0l2.3-2.3a4 4 0 0 0-5.7-5.7L11.4 7" />
      <path d="M13.5 10.5a4 4 0 0 0-5.7 0l-2.3 2.3a4 4 0 0 0 5.7 5.7L11.6 17" />
    </>
  ),
  external: (
    <>
      <path d="M14 4h6v6M20 4l-8 8" />
      <path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
    </>
  ),
  filter: <path d="M3.5 5.5h17l-6.5 7v6l-4 2v-8z" />,
  refresh: (
    <>
      <path d="M20 7v5h-5" />
      <path d="M19 12a7 7 0 1 1-2.1-5" />
    </>
  ),
  note: (
    <>
      <path d="M5 4.5h14v15H5z" />
      <path d="M8.5 9h7M8.5 12.5h7M8.5 16h4" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  book: (
    <>
      <path d="M5 4.5h10a4 4 0 0 1 4 4v11H8a3 3 0 0 0-3 3z" />
      <path d="M5 4.5v15" />
    </>
  ),
  flag: (
    <>
      <path d="M5.5 21V4.5M5.5 5h11l-2 3.5 2 3.5h-11" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c0-3.5 3.1-5.8 7-5.8s7 2.3 7 5.8" />
    </>
  ),
  lock: (
    <>
      <rect x="4.5" y="10" width="15" height="10" rx="1.5" />
      <path d="M8 10V7.5a4 4 0 0 1 8 0V10M12 14v2.5" />
    </>
  ),
  database: (
    <>
      <ellipse cx="12" cy="6" rx="7.5" ry="3" />
      <path d="M4.5 6v12c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3V6M4.5 12c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3" />
    </>
  ),
  save: (
    <>
      <path d="M4.5 4.5h12l3 3v12h-15z" />
      <path d="M8 4.5v5h7v-5M8 19.5v-5h8v5" />
    </>
  ),
}
