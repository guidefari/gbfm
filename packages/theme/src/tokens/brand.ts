export const brandDark = {
  highlightRgb: '85, 206, 246',
  bg: 'hsl(202 61% 22%)',
  darkerBg: '#111827',
  'pastel-green-1': 'hsl(195 75% 75%)',
  'pastel-green-2': 'hsl(198 45% 52%)',
  defaultText: 'hsl(194 52% 67%)'
} as const

export const brandLight = {
  highlightRgb: '43, 130, 238',
  bg: 'hsl(213 50% 93%)',
  darkerBg: 'hsl(0 0% 100%)',
  'pastel-green-1': 'hsl(213 60% 32%)',
  'pastel-green-2': 'hsl(213 50% 45%)',
  defaultText: 'hsl(213 30% 16%)'
} as const

export const brand = brandDark

export type BrandTokens = typeof brandDark
