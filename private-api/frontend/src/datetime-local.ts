/** Value for `input type="datetime-local"` in the browser's local time zone. */
export function toDatetimeLocalValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Parse `datetime-local` string as an instant in local time. */
export function parseDatetimeLocalToDate(value: string): Date | null {
  const v = value.trim()
  if (!v) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(v)
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  const h = Number(m[4])
  const mi = Number(m[5])
  if ([y, mo, d, h, mi].some((n) => !Number.isFinite(n))) return null
  return new Date(y, mo - 1, d, h, mi, 0, 0)
}
