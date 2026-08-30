export type MusicEntityType = 'album' | 'track' | 'playlist'

export const entityPathByType = {
  album: 'albums',
  track: 'tracks',
  playlist: 'playlists'
} satisfies Record<MusicEntityType, string>

export const entityLabelByType = {
  album: 'album',
  track: 'track',
  playlist: 'playlist'
} satisfies Record<MusicEntityType, string>

export function isMusicEntityType(value: string): value is MusicEntityType {
  return value === 'album' || value === 'track' || value === 'playlist'
}
