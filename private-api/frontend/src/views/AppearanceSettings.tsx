import type { ReactNode } from 'react'
import {
  ACCENT_PALETTES,
  ACCENT_SWATCH,
  useAppearance,
  type AccentPalette,
  type DensityMode,
  type ThemeMode,
} from '../appearance-context'
import { MoonIcon, SunIcon } from '../icons'
import type { Messages } from '../i18n'

type AppearanceSettingsProps = {
  t: Messages
}

function ThemeChoice({
  active,
  label,
  hint,
  onClick,
  children,
}: {
  active: boolean
  label: string
  hint: string
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      className={'appearance-choice' + (active ? ' is-active' : '')}
      onClick={onClick}
      aria-pressed={active}
    >
      <span className="appearance-choice-icon" aria-hidden>
        {children}
      </span>
      <span className="appearance-choice-copy">
        <span className="appearance-choice-label">{label}</span>
        <span className="appearance-choice-hint">{hint}</span>
      </span>
    </button>
  )
}

function accentLabel(accent: AccentPalette, t: Messages): string {
  switch (accent) {
    case 'blue':
      return t.appearanceAccentBlue
    case 'violet':
      return t.appearanceAccentViolet
    case 'green':
      return t.appearanceAccentGreen
    case 'rose':
      return t.appearanceAccentRose
    case 'amber':
      return t.appearanceAccentAmber
    case 'teal':
      return t.appearanceAccentTeal
  }
}

export function AppearanceSettings({ t }: AppearanceSettingsProps) {
  const {
    themeMode,
    density,
    reduceMotion,
    accent,
    setThemeMode,
    setDensity,
    setReduceMotion,
    setAccent,
  } = useAppearance()

  const densityOptions: { id: DensityMode; label: string; hint: string }[] = [
    {
      id: 'comfortable',
      label: t.appearanceDensityComfortable,
      hint: t.appearanceDensityComfortableHint,
    },
    {
      id: 'compact',
      label: t.appearanceDensityCompact,
      hint: t.appearanceDensityCompactHint,
    },
  ]

  const themeOptions: { id: ThemeMode; label: string; hint: string; icon: ReactNode }[] = [
    {
      id: 'light',
      label: t.appearanceThemeLight,
      hint: t.appearanceThemeLightHint,
      icon: <SunIcon width={20} height={20} />,
    },
    {
      id: 'dark',
      label: t.appearanceThemeDark,
      hint: t.appearanceThemeDarkHint,
      icon: <MoonIcon width={20} height={20} />,
    },
    {
      id: 'system',
      label: t.appearanceThemeSystem,
      hint: t.appearanceThemeSystemHint,
      icon: (
        <svg
          width={20}
          height={20}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden
        >
          <rect x="2" y="3" width="20" height="14" rx="2" />
          <path d="M8 21h8M12 17v4" />
        </svg>
      ),
    },
  ]

  return (
    <div className="settings-panel">
      <div className="settings-panel-head">
        <div>
          <h2 className="settings-panel-title">{t.appearanceTitle}</h2>
          <p className="settings-panel-lede">{t.appearanceLede}</p>
        </div>
      </div>

      <section className="appearance-section">
        <h3 className="appearance-section-title">{t.appearanceThemeHeading}</h3>
        <p className="appearance-section-lede">{t.appearanceThemeLede}</p>
        <div className="appearance-choice-grid appearance-choice-grid--3">
          {themeOptions.map((opt) => (
            <ThemeChoice
              key={opt.id}
              active={themeMode === opt.id}
              label={opt.label}
              hint={opt.hint}
              onClick={() => setThemeMode(opt.id)}
            >
              {opt.icon}
            </ThemeChoice>
          ))}
        </div>
      </section>

      <section className="appearance-section">
        <h3 className="appearance-section-title">{t.appearanceAccentHeading}</h3>
        <p className="appearance-section-lede">{t.appearanceAccentLede}</p>
        <div className="appearance-accent-grid" role="radiogroup" aria-label={t.appearanceAccentHeading}>
          {ACCENT_PALETTES.map((id) => (
            <button
              key={id}
              type="button"
              className={'appearance-accent-swatch' + (accent === id ? ' is-active' : '')}
              onClick={() => setAccent(id)}
              aria-pressed={accent === id}
              title={accentLabel(id, t)}
            >
              <span
                className="appearance-accent-dot"
                style={{ backgroundColor: ACCENT_SWATCH[id] }}
                aria-hidden
              />
              <span className="appearance-accent-name">{accentLabel(id, t)}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="appearance-section">
        <h3 className="appearance-section-title">{t.appearanceDensityHeading}</h3>
        <p className="appearance-section-lede">{t.appearanceDensityLede}</p>
        <div className="appearance-choice-grid">
          {densityOptions.map((opt) => (
            <ThemeChoice
              key={opt.id}
              active={density === opt.id}
              label={opt.label}
              hint={opt.hint}
              onClick={() => setDensity(opt.id)}
            >
              <span className="appearance-density-glyph" aria-hidden>
                {opt.id === 'comfortable' ? 'Aa' : 'A'}
              </span>
            </ThemeChoice>
          ))}
        </div>
      </section>

      <section className="appearance-section">
        <h3 className="appearance-section-title">{t.appearanceAccessibilityHeading}</h3>
        <label className="checkbox-row appearance-toggle-row">
          <input
            type="checkbox"
            checked={reduceMotion}
            onChange={(e) => setReduceMotion(e.target.checked)}
          />
          <span className="checkbox-row-text">
            <span>{t.appearanceReduceMotion}</span>
            <span className="field-hint muted-text">{t.appearanceReduceMotionHint}</span>
          </span>
        </label>
      </section>
    </div>
  )
}
