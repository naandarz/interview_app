import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export type ThemeMode = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'
export type ThemePalette = 'indigo' | 'emerald' | 'cyan' | 'violet' | 'rose'

const STORAGE_KEY = 'interview-workspace-theme'
const PALETTE_STORAGE_KEY = 'interview-workspace-palette'

export interface PaletteOption {
  id: ThemePalette
  name: string
  description: string
  color: string
}

export const PALETTE_OPTIONS: PaletteOption[] = [
  {
    id: 'indigo',
    name: 'Modern Indigo',
    description: 'Iris & Sapphire. Bersih, elegan, dan berstandar modern.',
    color: '#4f46e5',
  },
  {
    id: 'emerald',
    name: 'Emerald Forest',
    description: 'Zamrud & Teal. Segar, fokus, dan nyaman untuk membaca.',
    color: '#059669',
  },
  {
    id: 'cyan',
    name: 'Ocean Cyan',
    description: 'Sian Samudra. Jernih, cerah, dan dinamis.',
    color: '#0891b2',
  },
  {
    id: 'violet',
    name: 'Royal Violet',
    description: 'Violet & Lilac. Bernuansa kreatif dan kontemplatif.',
    color: '#7c3aed',
  },
  {
    id: 'rose',
    name: 'Rose Coral',
    description: 'Mawar & Koral. Hangat, bersahabat, dan energik.',
    color: '#e11d48',
  },
]

interface ThemeContextValue {
  mode: ThemeMode
  resolved: ResolvedTheme
  palette: ThemePalette
  setMode: (mode: ThemeMode) => void
  setPalette: (palette: ThemePalette) => void
  toggle: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function readStoredMode(): ThemeMode {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored
  } catch {
    // localStorage can be unavailable in private or restricted contexts.
  }
  return 'system'
}

function readStoredPalette(): ThemePalette {
  try {
    const stored = window.localStorage.getItem(PALETTE_STORAGE_KEY)
    if (stored === 'indigo' || stored === 'emerald' || stored === 'cyan' || stored === 'violet' || stored === 'rose') {
      return stored
    }
  } catch {
    // localStorage can be unavailable in private or restricted contexts.
  }
  return 'indigo'
}

function systemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(() => readStoredMode())
  const [palette, setPaletteState] = useState<ThemePalette>(() => readStoredPalette())
  const [system, setSystem] = useState<ResolvedTheme>(() => systemTheme())

  useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (event: MediaQueryListEvent) => setSystem(event.matches ? 'dark' : 'light')
    query.addEventListener('change', handler)
    return () => query.removeEventListener('change', handler)
  }, [])

  const resolved: ResolvedTheme = mode === 'system' ? system : mode

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', resolved === 'dark')
    root.style.colorScheme = resolved
    root.setAttribute('data-palette', palette)
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', resolved === 'dark' ? '#0b0f19' : '#f8fafc')
  }, [resolved, palette])

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next)
    try {
      window.localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Persisting the preference is optional.
    }
  }, [])

  const setPalette = useCallback((next: ThemePalette) => {
    setPaletteState(next)
    try {
      window.localStorage.setItem(PALETTE_STORAGE_KEY, next)
    } catch {
      // Persisting the preference is optional.
    }
  }, [])

  const toggle = useCallback(() => {
    setMode(resolved === 'dark' ? 'light' : 'dark')
  }, [resolved, setMode])

  const value = useMemo<ThemeContextValue>(
    () => ({ mode, resolved, palette, setMode, setPalette, toggle }),
    [mode, resolved, palette, setMode, setPalette, toggle],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme harus dipakai di dalam ThemeProvider')
  return ctx
}
