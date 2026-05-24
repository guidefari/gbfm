export const brand = {
  highlightRgb: '155, 253, 158',
  bg: 'hsl(202 61% 22%)',
  darkerBg: '#111827',
  'pastel-green-1': '#b6fadf',
  'pastel-green-2': '#4e8c71',
  defaultText: 'hsl(194 52% 67%)'
} as const

export type BrandTokens = typeof brand
