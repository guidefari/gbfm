const themes = ['light', 'dark', 'studio'] as const

type Theme = (typeof themes)[number]

const navItems = [
  {
    id: 'overview',
    label: 'Overview',
    description: 'All primitives together'
  },
  {
    id: 'buttons',
    label: 'Buttons',
    description: 'Actions, sizes, and variants'
  },
  {
    id: 'forms',
    label: 'Forms',
    description: 'Inputs, labels, select, OTP'
  },
  {
    id: 'structure',
    label: 'Structure',
    description: 'Cards, tabs, accordion, scroll'
  },
  {
    id: 'menus',
    label: 'Menus',
    description: 'Dropdown, context, command'
  },
  {
    id: 'overlays',
    label: 'Overlays',
    description: 'Dialog, sheet, tooltip, toast'
  },
  {
    id: 'media-card',
    label: 'Media Card',
    description: 'Music-first product pattern'
  }
] as const

type PanelId = (typeof navItems)[number]['id']

const viewportPresets = [
  { id: 'mobile', label: 'Mobile', width: 390, height: 720 },
  { id: 'tablet', label: 'Tablet', width: 768, height: 760 },
  { id: 'desktop', label: 'Desktop', width: 1120, height: 780 },
  { id: 'full', label: 'Full', width: '100%', height: '100%' },
  { id: 'custom', label: 'Custom', width: 960, height: 760 }
] as const

type ViewportPresetId = (typeof viewportPresets)[number]['id']

const mediaExamples = [
  {
    title: 'Late Night Transmissions 04',
    eyebrow: 'Mix',
    imageUrl:
      'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=900&q=80',
    description:
      'Dubwise pressure, loose percussion, and slow-burning warehouse records.',
    tags: ['dub', 'leftfield', 'club']
  },
  {
    title: 'Signals From The Green Room',
    eyebrow: 'Editorial',
    imageUrl:
      'https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&w=900&q=80',
    description:
      'Notes on overlooked records, room tone, and the DJs who connect scenes.',
    tags: ['essay', 'records', 'scene report']
  }
]

export type { PanelId, Theme, ViewportPresetId }
export { mediaExamples, navItems, themes, viewportPresets }
