export type MdxMusicReference = {
  type: 'album' | 'track' | 'playlist'
  encodedUrl: string
}

const componentType = {
  Album: 'album',
  Track: 'track',
  Playlist: 'playlist'
} as const

const musicComponentPattern =
  /<(Album|Track|Playlist)\b[^>]*\burl\s*=\s*(["'])(.*?)\2[^>]*\/?\s*>/gs

export function mdxMusicReferences(content: string | null | undefined): MdxMusicReference[] {
  if (!content) return []
  return [...content.matchAll(musicComponentPattern)].flatMap((match) => {
    const component = match[1]
    if (component !== 'Album' && component !== 'Track' && component !== 'Playlist') return []
    return [{ type: componentType[component], encodedUrl: encodeURIComponent(match[3]) }]
  })
}
