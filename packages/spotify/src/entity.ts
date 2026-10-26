/** Pure Spotify entity references, safe to use without loading the browser SDK. */
export const SPOTIFY_ENTITY_KIND = {
  TRACK: 'track',
  ALBUM: 'album',
  PLAYLIST: 'playlist',
} as const

export type SpotifyEntityKind = (typeof SPOTIFY_ENTITY_KIND)[keyof typeof SPOTIFY_ENTITY_KIND]

export type SpotifyEntityRef = {
  kind: SpotifyEntityKind
  id: string
  uri: string
}

const ENTITY_URL_PATTERN = /spotify\.com\/(?:intl-[a-z-]+\/)?(track|album|playlist)\/([A-Za-z0-9]+)/

const ENTITY_URI_PATTERN = /^spotify:(track|album|playlist):([A-Za-z0-9]+)$/

export const spotifyEntityFromUrl = (url: string): SpotifyEntityRef | null => {
  const match = url.match(ENTITY_URL_PATTERN) ?? url.match(ENTITY_URI_PATTERN)
  const kind = match?.[1]
  const id = match?.[2]

  if (!kind || !id) return null

  if (kind !== 'track' && kind !== 'album' && kind !== 'playlist') return null

  return { kind, id, uri: `spotify:${kind}:${id}` }
}
