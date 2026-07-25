export const brandDark = {
  highlightRgb: '85, 206, 246',
  bg: 'hsl(202 61% 22%)',
  darkerBg: '#111827',
  'pastel-green-1': 'hsl(195 75% 75%)',
  'pastel-green-2': 'hsl(198 45% 52%)',
  defaultText: 'hsl(194 52% 67%)',
  overlayText: '#FFFFFF',
  faintOverlayText: '#FFFFFF2E',
  error: '#FDA4AF',
  success: '#4ADE80',
  warning: '#FACC15',
  accentSurface: '#7DD3FC',
  shadow: '#000000'
} as const

export const brandLight = {
  highlightRgb: '43, 130, 238',
  bg: 'hsl(213 40% 96%)',
  darkerBg: 'hsl(0 0% 100%)',
  'pastel-green-1': 'hsl(213 68% 24%)',
  'pastel-green-2': 'hsl(213 42% 34%)',
  defaultText: 'hsl(213 30% 12%)',
  overlayText: '#FFFFFF',
  faintOverlayText: '#FFFFFF2E',
  error: '#FDA4AF',
  success: '#15803D',
  warning: '#A16207',
  accentSurface: '#7DD3FC',
  shadow: '#000000'
} as const

export const brand = brandDark

export type BrandTokens = typeof brandDark
