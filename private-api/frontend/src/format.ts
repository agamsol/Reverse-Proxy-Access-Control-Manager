import type { Lang, Messages } from './i18n'

// The admin is English-only; the `lang` parameter is kept for call-site
// compatibility and future reintroduction of other locales.
export function formatRelativeTime(target: Date, _lang: Lang = 'en'): string {
  void _lang
  const diffSec = (target.getTime() - Date.now()) / 1000
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
  const abs = Math.abs(diffSec)
  const sign = diffSec < 0 ? -1 : 1
  if (abs < 60) return rtf.format(sign * Math.round(abs), 'second')
  const diffMin = abs / 60
  if (diffMin < 60) return rtf.format(sign * Math.round(diffMin), 'minute')
  const diffHour = diffMin / 60
  if (diffHour < 24) return rtf.format(sign * Math.round(diffHour), 'hour')
  const diffDay = diffHour / 24
  if (diffDay < 30) return rtf.format(sign * Math.round(diffDay), 'day')
  const diffMonth = diffDay / 30
  if (diffMonth < 12) return rtf.format(sign * Math.round(diffMonth), 'month')
  return rtf.format(sign * Math.round(diffDay / 365), 'year')
}

export function formatDateTime(date: Date, _lang: Lang = 'en'): string {
  void _lang
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

/** Human-friendly expiry duration (minutes → m/h/d). */
export function formatMinutes(minutes: number | null | undefined, t: Messages): string {
  if (minutes == null) return t.expiryNotSet
  if (minutes < 60) return t.expiryMinutes.replace('{n}', String(minutes))
  if (minutes < 60 * 24) {
    const hours = Math.round(minutes / 60)
    return t.expiryHours.replace('{n}', String(hours))
  }
  const days = Math.round(minutes / (60 * 24))
  return t.expiryDays.replace('{n}', String(days))
}

export function fmt(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => {
    return k in vars ? String(vars[k]) : `{${k}}`
  })
}
