import { useState } from 'react'

export const DEFAULT_PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const

/** Page-size state backed by `localStorage` under the given key. */
export function usePersistedPageSize(
  key: string,
  fallback = 10,
): [number, (n: number) => void] {
  const [value, setValue] = useState<number>(() => {
    if (typeof localStorage === 'undefined') return fallback
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    const n = Number(raw)
    return Number.isFinite(n) && n > 0 ? n : fallback
  })

  const set = (n: number) => {
    setValue(n)
    try {
      localStorage.setItem(key, String(n))
    } catch {
      // no-op when localStorage is unavailable
    }
  }

  return [value, set]
}
