import type { CSSProperties } from 'react'

type AvatarProps = {
  /** Full name / username to derive initials from. */
  name: string
  /** Pixel size of the circle (defaults to 32). */
  size?: number
  className?: string
  title?: string
}

function initials(name: string): string {
  const words = name
    .trim()
    .split(/[\s._-]+/)
    .filter(Boolean)
  if (words.length === 0) return '?'
  const letters = words.slice(0, 3).map((w) => (w[0] ?? '').toUpperCase())
  return letters.join('') || '?'
}

// Picks a stable hue from the name so different accounts get different colors.
function hashHue(input: string): number {
  let h = 0
  for (let i = 0; i < input.length; i++) {
    h = (h * 31 + input.charCodeAt(i)) | 0
  }
  return Math.abs(h) % 360
}

export function Avatar({ name, size = 32, className, title }: AvatarProps) {
  const letters = initials(name)
  const hue = hashHue(name.toLowerCase())
  const style: CSSProperties & Record<string, string> = {
    width: `${size}px`,
    height: `${size}px`,
    fontSize: `${Math.round(size * 0.42)}px`,
    '--avatar-hue': String(hue),
  }
  return (
    <span
      className={'avatar ' + (className ?? '')}
      style={style}
      title={title ?? name}
      role="img"
      aria-label={name}
    >
      {letters}
    </span>
  )
}
