export const emailTheme = {
  // Synced with apps/www/src/styles/main.css custom colors.
  typography: {
    sans: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    sansAlt:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
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
      page: '#111827',
      container: 'hsl(202, 61%, 22%)',
      header: '#4e8c71',
      textPrimary: '#9bfd9e',
      textSecondary: 'hsl(194, 52%, 67%)',
      textTertiary: '#b6fadf',
      textInverse: '#111827',
      white: '#ffffff'
    },
    status: {
      failureContainer: '#5a1a1a',
      failureSurface: '#8c4e4e'
    },
    mono: {
      page: '#111827',
      border: 'hsl(202, 61%, 22%)',
      white: '#ffffff',
      black: '#000000',
      textMuted: '#4e8c71',
      textSecondary: 'hsl(194, 52%, 67%)',
      textPrimary: '#9bfd9e',
      textTertiary: '#b6fadf'
    }
  }
} as const
