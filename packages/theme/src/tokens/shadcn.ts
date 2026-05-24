export interface SemanticTokens {
  highlight: string
  highlightForeground: string
  background: string
  foreground: string
  card: string
  cardForeground: string
  popover: string
  popoverForeground: string
  primary: string
  primaryForeground: string
  secondary: string
  secondaryForeground: string
  muted: string
  mutedForeground: string
  accent: string
  accentForeground: string
  destructive: string
  destructiveForeground: string
  border: string
  input: string
  ring: string
  radius: string
}

export const light: SemanticTokens = {
  highlight: '#9bfd9e',
  highlightForeground: '#111827',
  background: 'hsl(194, 52%, 67%)',
  foreground: 'hsl(215 6.1% 0.88)',
  card: 'hsl(0, 0%, 100%)',
  cardForeground: 'hsl(224, 71.4%, 4.1%)',
  popover: 'hsl(0, 0%, 100%)',
  popoverForeground: 'hsl(224, 71.4%, 4.1%)',
  primary: 'hsl(220.9, 39.3%, 11%)',
  primaryForeground: 'hsl(194, 52%, 67%)',
  secondary: 'hsl(220, 14.3%, 95.9%)',
  secondaryForeground: 'hsl(220.9, 39.3%, 11%)',
  muted: 'hsl(220, 14.3%, 95.9%)',
  mutedForeground: 'hsl(220, 15%, 40%)',
  accent: 'hsl(220, 14.3%, 95.9%)',
  accentForeground: 'hsl(220.9, 39.3%, 11%)',
  destructive: 'hsl(0, 84.2%, 60.2%)',
  destructiveForeground: 'hsl(194, 52%, 67%)',
  border: 'hsl(215, 27.9%, 16.9%)',
  input: 'hsl(220, 13%, 91%)',
  ring: 'hsl(224, 71.4%, 4.1%)',
  radius: '0px'
}

export const dark: SemanticTokens = {
  highlight: '#9bfd9e',
  highlightForeground: '#111827',
  background: 'hsl(202, 61%, 22%)',
  foreground: 'hsl(194, 52%, 67%)',
  card: 'hsl(224, 71.4%, 4.1%)',
  cardForeground: 'hsl(194, 52%, 67%)',
  popover: 'hsl(224, 71.4%, 4.1%)',
  popoverForeground: 'hsl(194, 52%, 67%)',
  primary: 'hsl(194, 52%, 67%)',
  primaryForeground: 'hsl(220.9, 39.3%, 11%)',
  secondary: 'hsl(215, 27.9%, 16.9%)',
  secondaryForeground: 'hsl(194, 52%, 67%)',
  muted: 'hsl(215, 27.9%, 18%)',
  mutedForeground: 'hsl(194, 40%, 60%)',
  accent: 'hsl(215, 27.9%, 16.9%)',
  accentForeground: 'hsl(194, 52%, 67%)',
  destructive: 'hsl(0, 62.8%, 30.6%)',
  destructiveForeground: 'hsl(194, 52%, 67%)',
  border: 'hsl(220, 13%, 91%)',
  input: 'hsl(215, 27.9%, 16.9%)',
  ring: 'hsl(216, 12.2%, 83.9%)',
  radius: '0px'
}

export const studio: SemanticTokens = {
  highlight: 'hsl(24 100% 63%)',
  highlightForeground: 'hsl(36 45% 92%)',
  background: 'hsl(28 22% 9%)',
  foreground: 'hsl(38 54% 84%)',
  card: 'hsl(30 24% 13%)',
  cardForeground: 'hsl(38 54% 84%)',
  popover: 'hsl(30 24% 13%)',
  popoverForeground: 'hsl(38 54% 84%)',
  primary: 'hsl(24 100% 63%)',
  primaryForeground: 'hsl(28 22% 9%)',
  secondary: 'hsl(39 28% 22%)',
  secondaryForeground: 'hsl(38 54% 84%)',
  muted: 'hsl(31 20% 20%)',
  mutedForeground: 'hsl(39 24% 66%)',
  accent: 'hsl(343 54% 38%)',
  accentForeground: 'hsl(38 54% 84%)',
  destructive: 'hsl(0 70% 44%)',
  destructiveForeground: 'hsl(38 54% 84%)',
  border: 'hsl(39 26% 34%)',
  input: 'hsl(31 20% 20%)',
  ring: 'hsl(24 100% 63%)',
  radius: '2px'
}
