export type MusicEntityType = 'album' | 'track' | 'playlist'

export type MusicEntityReference = {
  readonly type: MusicEntityType
  readonly id: string
}

export const musicEntityTypes: ReadonlyArray<MusicEntityType> = ['album', 'track', 'playlist']

export function serializeMusicEntity({ type, id }: MusicEntityReference): string {
  const escapedId = id.replaceAll('&', '&amp;').replaceAll('"', '&quot;')
  return `<MusicEntity type="${type}" id="${escapedId}" />`
}
