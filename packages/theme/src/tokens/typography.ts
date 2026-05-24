export const typography = {
  fontJetbrains:
    'JetBrainsMono, ui-monospace, monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, Courier New',
  fontSans: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  fontSansAlt: "Georgia, 'Times New Roman', Times, serif",
  fontSizePx: { 1: 16, 2: 18, 3: 24, 4: 32, 5: 42 } as const
} as const

export type TypographyTokens = typeof typography
