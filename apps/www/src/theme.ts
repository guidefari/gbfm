import { Option, Schema } from 'effect'

export const Theme = Schema.Literals(['light', 'dark', 'system'])

export type Theme = typeof Theme.Type

export const readTheme = (): Theme => {
  try {
    return Option.getOrElse(
      Schema.decodeUnknownOption(Theme)(localStorage.getItem('vite-ui-theme')),
      () => 'system',
    )
  } catch {
    // Storage can be unavailable in private contexts; system remains usable.
    return 'system'
  }
}

const applyTheme = (theme: Theme) => {
  const resolved =
    theme === 'system'
      ? matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
      : theme

  document.documentElement.classList.remove('light', 'dark')
  document.documentElement.classList.add(resolved)
  document.documentElement.dataset.theme = resolved
}

export const saveTheme = (theme: Theme) => {
  try {
    localStorage.setItem('vite-ui-theme', theme)
  } catch {
    // Apply the preference for this page even when persistence is unavailable.
  }

  applyTheme(theme)
}

export const startTheme = () => {
  const media = matchMedia('(prefers-color-scheme: dark)')
  const refresh = () => applyTheme(readTheme())
  refresh()
  media.addEventListener('change', refresh)
  window.addEventListener('storage', refresh)

  return () => {
    media.removeEventListener('change', refresh)
    window.removeEventListener('storage', refresh)
  }
}
