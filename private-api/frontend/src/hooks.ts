import { useCallback, useEffect, useState } from 'react'

const THEME_KEY = 'rpacm-admin-theme'

export function useTheme() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof localStorage === 'undefined') return 'light'
    const stored = localStorage.getItem(THEME_KEY)
    return stored === 'dark' ? 'dark' : 'light'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem(THEME_KEY, theme)
  }, [theme])

  const toggle = useCallback(() => {
    setTheme((v) => (v === 'light' ? 'dark' : 'light'))
  }, [])

  return { theme, toggle }
}

// The admin dashboard is English-only. Any previously persisted Hebrew
// preference is cleaned up here so the page direction stays LTR.
export function useEnglishOnlyLocale() {
  useEffect(() => {
    document.documentElement.lang = 'en'
    document.documentElement.dir = 'ltr'
    try {
      localStorage.removeItem('rpacm-admin-lang')
    } catch {
      // no-op when localStorage is unavailable
    }
  }, [])
}
