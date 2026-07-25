import { brandDark, brandLight } from '@gbfm/theme'
import { useColorScheme } from 'react-native'
import { useColorSchemePreference } from '@/store/preferences'

export type ThemeColors = {
  readonly background: string
  readonly accent: string
  readonly muted: string
  readonly text: string
  readonly strong: string
  readonly surface: string
  readonly onAccent: string
}

const darkColors: ThemeColors = {
  background: brandDark.bg,
  accent: brandDark['pastel-green-1'],
  muted: brandDark['pastel-green-2'],
  text: brandDark.defaultText,
  strong: '#FFFFFF',
  surface: brandDark.darkerBg,
  onAccent: brandDark.darkerBg
}

const lightColors: ThemeColors = {
  background: brandLight.bg,
  accent: brandLight['pastel-green-1'],
  muted: brandLight['pastel-green-2'],
  text: brandLight.defaultText,
  strong: brandLight.defaultText,
  surface: brandLight.darkerBg,
  onAccent: '#FFFFFF'
}

/**
 * Brand tokens are `hsl(H S% L%)` strings, so `${color}66`-style alpha
 * suffixes produce invalid colors. Convert to comma `hsla()` / `#rrggbbaa`,
 * which React Native's color parser understands.
 */
export const withAlpha = (color: string, alpha: number): string => {
  const hsl = color.match(/^hsl\(\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%\s*\)$/)
  if (hsl) return `hsla(${hsl[1]}, ${hsl[2]}%, ${hsl[3]}%, ${alpha})`
  if (/^#[0-9a-fA-F]{6}$/.test(color)) {
    const channel = Math.round(alpha * 255)
      .toString(16)
      .padStart(2, '0')
    return `${color}${channel}`
  }
  return color
}

export const useThemeColors = (): ThemeColors => {
  const systemColorScheme = useColorScheme()
  const preference = useColorSchemePreference()
  const colorScheme = preference === 'system' ? systemColorScheme : preference
  return colorScheme === 'light' ? lightColors : darkColors
}
