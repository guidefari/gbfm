export const platformColors = {
  spotify: '#1DB954',
  youtube: '#FF0000',
  appleMusic: '#FA243C',
  bandcamp: '#629AA9',
  soundcloud: '#FF5500',
  tidal: '#000000',
  discord: '#5865F2',
  instagram: '#E4405F',
  twitter: '#000000'
} as const

export type PlatformColors = typeof platformColors
