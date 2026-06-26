import { useAppearance } from './appearance-context'

export { useEnglishOnlyLocale } from './hooks-locale'
export {
  ACCENT_PALETTES,
  ACCENT_SWATCH,
  AppearanceProvider,
  bootstrapAppearance,
  useAppearance,
  type AccentPalette,
  type DensityMode,
  type ThemeMode,
} from './appearance-context'

/** @deprecated Use `useAppearance` from the appearance context. */
export function useTheme() {
  const { theme, toggleTheme } = useAppearance()
  return { theme, toggle: toggleTheme }
}
