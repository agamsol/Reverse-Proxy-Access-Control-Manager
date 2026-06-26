import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

const APPEARANCE_KEY = 'rpacm-admin-appearance'

export type ThemeMode = 'light' | 'dark' | 'system'
export type DensityMode = 'comfortable' | 'compact'
export type AccentPalette = 'blue' | 'violet' | 'green' | 'rose' | 'amber' | 'teal'

export const ACCENT_PALETTES: readonly AccentPalette[] = [
  'blue',
  'violet',
  'green',
  'rose',
  'amber',
  'teal',
]

type AppearancePrefs = {
  themeMode: ThemeMode
  density: DensityMode
  reduceMotion: boolean
  accent: AccentPalette
}

const DEFAULT_PREFS: AppearancePrefs = {
  themeMode: 'system',
  density: 'comfortable',
  reduceMotion: false,
  accent: 'blue',
}

function readPrefs(): AppearancePrefs {
  if (typeof localStorage === 'undefined') return DEFAULT_PREFS
  try {
    const raw = localStorage.getItem(APPEARANCE_KEY)
    if (!raw) return DEFAULT_PREFS
    const parsed = JSON.parse(raw) as Partial<AppearancePrefs>
    return {
      themeMode:
        parsed.themeMode === 'light' || parsed.themeMode === 'dark' || parsed.themeMode === 'system'
          ? parsed.themeMode
          : DEFAULT_PREFS.themeMode,
      density: parsed.density === 'compact' ? 'compact' : 'comfortable',
      reduceMotion: Boolean(parsed.reduceMotion),
      accent: ACCENT_PALETTES.includes(parsed.accent as AccentPalette)
        ? (parsed.accent as AccentPalette)
        : DEFAULT_PREFS.accent,
    }
  } catch {
    return DEFAULT_PREFS
  }
}

function writePrefs(prefs: AppearancePrefs) {
  try {
    localStorage.setItem(APPEARANCE_KEY, JSON.stringify(prefs))
  } catch {
    // no-op when localStorage is unavailable
  }
}

function resolveTheme(mode: ThemeMode, systemDark: boolean): 'light' | 'dark' {
  if (mode === 'system') return systemDark ? 'dark' : 'light'
  return mode
}

export function applyAppearanceToDocument(
  prefs: AppearancePrefs,
  resolvedTheme: 'light' | 'dark',
) {
  const root = document.documentElement
  root.setAttribute('data-theme', resolvedTheme)
  root.setAttribute('data-density', prefs.density)
  root.setAttribute('data-accent', prefs.accent)
  if (prefs.reduceMotion) {
    root.setAttribute('data-reduce-motion', 'true')
  } else {
    root.removeAttribute('data-reduce-motion')
  }
}

/** Apply saved prefs before React mounts to reduce theme flash. */
export function bootstrapAppearance() {
  if (typeof document === 'undefined') return
  const prefs = readPrefs()
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  applyAppearanceToDocument(prefs, resolveTheme(prefs.themeMode, systemDark))
}

type AppearanceContextValue = {
  theme: 'light' | 'dark'
  themeMode: ThemeMode
  density: DensityMode
  reduceMotion: boolean
  accent: AccentPalette
  setThemeMode: (mode: ThemeMode) => void
  setDensity: (density: DensityMode) => void
  setReduceMotion: (value: boolean) => void
  setAccent: (accent: AccentPalette) => void
  toggleTheme: () => void
}

const AppearanceContext = createContext<AppearanceContextValue | null>(null)

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<AppearancePrefs>(() => readPrefs())
  const [systemDark, setSystemDark] = useState(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : false,
  )

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => setSystemDark(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const theme = useMemo(
    () => resolveTheme(prefs.themeMode, systemDark),
    [prefs.themeMode, systemDark],
  )

  useEffect(() => {
    applyAppearanceToDocument(prefs, theme)
    writePrefs(prefs)
  }, [prefs, theme])

  const setThemeMode = useCallback((themeMode: ThemeMode) => {
    setPrefs((prev) => ({ ...prev, themeMode }))
  }, [])

  const setDensity = useCallback((density: DensityMode) => {
    setPrefs((prev) => ({ ...prev, density }))
  }, [])

  const setReduceMotion = useCallback((reduceMotion: boolean) => {
    setPrefs((prev) => ({ ...prev, reduceMotion }))
  }, [])

  const setAccent = useCallback((accent: AccentPalette) => {
    setPrefs((prev) => ({ ...prev, accent }))
  }, [])

  const toggleTheme = useCallback(() => {
    setPrefs((prev) => ({
      ...prev,
      themeMode: resolveTheme(prev.themeMode, systemDark) === 'light' ? 'dark' : 'light',
    }))
  }, [systemDark])

  const value = useMemo(
    () => ({
      theme,
      themeMode: prefs.themeMode,
      density: prefs.density,
      reduceMotion: prefs.reduceMotion,
      accent: prefs.accent,
      setThemeMode,
      setDensity,
      setReduceMotion,
      setAccent,
      toggleTheme,
    }),
    [
      theme,
      prefs,
      setThemeMode,
      setDensity,
      setReduceMotion,
      setAccent,
      toggleTheme,
    ],
  )

  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>
}

export function useAppearance(): AppearanceContextValue {
  const ctx = useContext(AppearanceContext)
  if (!ctx) {
    throw new Error('useAppearance must be used within AppearanceProvider')
  }
  return ctx
}

/** Swatch colors for the accent picker (light-mode accent hex). */
export const ACCENT_SWATCH: Record<AccentPalette, string> = {
  blue: '#2563eb',
  violet: '#7c3aed',
  green: '#059669',
  rose: '#e11d48',
  amber: '#d97706',
  teal: '#0d9488',
}
