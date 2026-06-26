import { useEffect } from 'react'

// The admin dashboard is English-only. Any previously persisted Hebrew
// preference is cleaned up here so the page direction stays LTR.
export function useEnglishOnlyLocale() {
  useEffect(() => {
    document.documentElement.lang = 'en'
    document.documentElement.dir = 'ltr'
    try {
      localStorage.removeItem('rpacm-admin-lang')
      localStorage.removeItem('rpacm-admin-theme')
    } catch {
      // no-op when localStorage is unavailable
    }
  }, [])
}
