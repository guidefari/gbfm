import { brand, light, typography } from '@gbfm/theme'

export const emailTheme = {
  typography: {
    sans: typography.fontSans,
    sansAlt: typography.fontSans,
    mono: 'monospace'
  },
  radius: {
    sm: '4px',
    md: '6px',
    lg: '12px',
    pill: '30px'
  },
  colors: {
    brand: {
      page: light.background,
      container: light.card,
      header: brand['pastel-green-2'],
      textPrimary: light.primary,
      textSecondary: light.foreground,
      textTertiary: brand['pastel-green-2'],
      textInverse: light.primaryForeground,
      white: '#ffffff'
    },
    status: {
      failureContainer: '#fde8e8',
      failureSurface: '#f87171'
    },
    mono: {
      page: light.background,
      border: light.border,
      white: '#ffffff',
      black: '#000000',
      textMuted: light.mutedForeground,
      textSecondary: light.foreground,
      textPrimary: light.primary,
      textTertiary: brand['pastel-green-2']
    }
  }
} as const
