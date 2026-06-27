import { useState, useRef, useEffect } from 'react'
import type { Lang } from './i18n'

const FLAG_BASE = `${import.meta.env.BASE_URL}flags/`

const LANG_OPTIONS: { value: Lang; flag: string; labelKey: 'langEn' | 'langHe' }[] = [
  { value: 'en', flag: 'en.svg', labelKey: 'langEn' },
  { value: 'he', flag: 'he.svg', labelKey: 'langHe' },
]

type LangPickerProps = {
  lang: Lang
  onChange: (lang: Lang) => void
  labels: { language: string; langEn: string; langHe: string }
}

export function LangPicker({ lang, onChange, labels }: LangPickerProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const current = LANG_OPTIONS.find((o) => o.value === lang) ?? LANG_OPTIONS[0]

  useEffect(() => {
    if (!open) return
    const onClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    document.addEventListener('keydown', onEscape)
    return () => {
      document.removeEventListener('mousedown', onClickOutside)
      document.removeEventListener('keydown', onEscape)
    }
  }, [open])

  const handleSelect = (value: Lang) => {
    onChange(value)
    setOpen(false)
  }

  return (
    <div className="lang-dropdown" ref={containerRef}>
      <button
        type="button"
        className="lang-dropdown-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={labels.language}
        title={labels[current.labelKey]}
      >
        <img
          src={`${FLAG_BASE}${current.flag}`}
          alt={labels[current.labelKey]}
          width={26}
          height={20}
          className="lang-dropdown-flag"
        />
        <svg
          className="lang-dropdown-chevron"
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden
        >
          <path
            d="M6 9l6 6 6-6"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {open && (
        <ul className="lang-dropdown-menu" role="listbox" aria-label={labels.language}>
          {LANG_OPTIONS.map((opt) => (
            <li key={opt.value} role="option" aria-selected={lang === opt.value}>
              <button
                type="button"
                className={`lang-dropdown-item ${lang === opt.value ? 'active' : ''}`}
                onClick={() => handleSelect(opt.value)}
              >
                <img
                  src={`${FLAG_BASE}${opt.flag}`}
                  alt=""
                  width={24}
                  height={18}
                  className="lang-dropdown-item-flag"
                />
                <span>{labels[opt.labelKey]}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
