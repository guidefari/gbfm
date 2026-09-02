export const externalMediaProviders = {
  spotify: 'spotify',
  soundcloud: 'soundcloud',
  bandcamp: 'bandcamp',
  youtube: 'youtube'
} as const

export type ExternalMediaProvider =
  (typeof externalMediaProviders)[keyof typeof externalMediaProviders]

export type ExternalMediaReference = {
  readonly provider: ExternalMediaProvider
  readonly url: string
}

export type ExternalMediaEmbed = {
  readonly provider: ExternalMediaProvider
  readonly src: string
  readonly title: string
  readonly height: number
  readonly allow: string
}

export type ExternalMediaParseResult =
  | { readonly ok: true; readonly media: ExternalMediaReference }
  | { readonly ok: false; readonly message: string }

const spotifyTypes = new Set(['album', 'episode', 'playlist', 'show', 'track'])
const spotifyIdPattern = /^[A-Za-z0-9]{22}$/
const youtubeIdPattern = /^[A-Za-z0-9_-]{11}$/
const bandcampEmbedPattern = /^\/(?:EmbeddedPlayer)\/(album|track)=(\d+)(?:\/.*)?$/

const messages = {
  invalid: 'Paste a complete Spotify, SoundCloud, Bandcamp, or YouTube URL.',
  unsupported: 'This link is not from a supported media provider.',
  spotify: 'Paste a Spotify album, episode, playlist, show, or track link.',
  soundcloud: 'Paste a SoundCloud track or playlist link.',
  bandcamp: 'Paste a Bandcamp album or track link.',
  youtube: 'Paste a YouTube video link.'
} as const

export function parseExternalMediaUrl(value: string): ExternalMediaParseResult {
  const url = parseHttpUrl(value)
  if (url === null) return failure(messages.invalid)

  if (isSpotifyHost(url.hostname)) return parseSpotifyUrl(url)
  if (isSoundCloudHost(url.hostname)) return parseSoundCloudUrl(url)
  if (isBandcampHost(url.hostname)) return parseBandcampUrl(url)
  if (isYouTubeHost(url.hostname)) return parseYouTubeUrl(url)

  return failure(messages.unsupported)
}

export function externalMediaMarkdown(media: ExternalMediaReference): string {
  return `<ExternalMedia provider="${media.provider}" url="${media.url}" />`
}

export function externalMediaEmbed(media: ExternalMediaReference): ExternalMediaEmbed | null {
  const parsed = parseExternalMediaUrl(media.url)
  if (!parsed.ok || parsed.media.provider !== media.provider) return null

  switch (parsed.media.provider) {
    case externalMediaProviders.spotify:
      return spotifyEmbed(parsed.media)
    case externalMediaProviders.soundcloud:
      return soundcloudEmbed(parsed.media)
    case externalMediaProviders.bandcamp:
      return bandcampEmbed(parsed.media)
    case externalMediaProviders.youtube:
      return youtubeEmbed(parsed.media)
  }

  return null
}

export function bandcampOembedUrl(media: ExternalMediaReference): string | null {
  const parsed = parseExternalMediaUrl(media.url)
  if (!parsed.ok || parsed.media.provider !== externalMediaProviders.bandcamp) return null
  if (bandcampEmbed(parsed.media) !== null) return null

  return `https://bandcamp.com/oembed?format=json&url=${encodeURIComponent(parsed.media.url)}`
}

export function parseBandcampOembedJson(value: string): ExternalMediaParseResult {
  const source = extractBandcampEmbedUrl(value)
  if (source === null) return failure(messages.bandcamp)

  return parseExternalMediaUrl(source.replaceAll('\\/', '/'))
}

function parseHttpUrl(value: string): URL | null {
  try {
    const url = new URL(value.trim())
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    if (url.username || url.password || url.port) return null
    return url
  } catch {
    return null
  }
}

function parseSpotifyUrl(url: URL): ExternalMediaParseResult {
  const segments = pathSegments(url)
  const contentSegments = segments[0] === 'embed' ? segments.slice(1) : segments
  const startIndex = contentSegments[0]?.startsWith('intl-') ? 1 : 0
  const type = contentSegments[startIndex]
  const id = contentSegments[startIndex + 1]

  if (
    type === undefined ||
    id === undefined ||
    contentSegments.length !== startIndex + 2 ||
    !spotifyTypes.has(type) ||
    !spotifyIdPattern.test(id)
  ) {
    return failure(messages.spotify)
  }

  return success(externalMediaProviders.spotify, `https://open.spotify.com/${type}/${id}`)
}

function parseSoundCloudUrl(url: URL): ExternalMediaParseResult {
  const segments = pathSegments(url)
  if (segments.length < 2 || segments.length > 4) return failure(messages.soundcloud)

  return success(
    externalMediaProviders.soundcloud,
    `https://soundcloud.com/${segments.map(encodeURIComponent).join('/')}`
  )
}

function parseBandcampUrl(url: URL): ExternalMediaParseResult {
  const embedded = parseBandcampEmbedPath(url)
  if (embedded !== null) return success(externalMediaProviders.bandcamp, embedded)

  const segments = pathSegments(url)
  const type = segments[0]
  const slug = segments[1]
  if ((type !== 'album' && type !== 'track') || slug === undefined || segments.length !== 2) {
    return failure(messages.bandcamp)
  }

  return success(
    externalMediaProviders.bandcamp,
    `https://${url.hostname.toLowerCase()}/${type}/${encodeURIComponent(slug)}`
  )
}

function parseYouTubeUrl(url: URL): ExternalMediaParseResult {
  const id = youTubeVideoId(url)
  if (id === null || !youtubeIdPattern.test(id)) return failure(messages.youtube)

  return success(externalMediaProviders.youtube, `https://www.youtube.com/watch?v=${id}`)
}

function spotifyEmbed(media: ExternalMediaReference): ExternalMediaEmbed | null {
  const [, type, id] = new URL(media.url).pathname.split('/')
  if (type === undefined || id === undefined) return null

  return {
    provider: media.provider,
    src: `https://open.spotify.com/embed/${type}/${id}`,
    title: 'Spotify player',
    height: type === 'track' ? 152 : 352,
    allow: 'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture'
  }
}

function soundcloudEmbed(media: ExternalMediaReference): ExternalMediaEmbed {
  return {
    provider: media.provider,
    src: `https://w.soundcloud.com/player/?url=${encodeURIComponent(media.url)}&color=%23ff5500&auto_play=false&hide_related=false&show_comments=true&show_user=true&show_reposts=false&show_teaser=true`,
    title: 'SoundCloud player',
    height: 166,
    allow: 'autoplay'
  }
}

function bandcampEmbed(media: ExternalMediaReference): ExternalMediaEmbed | null {
  const url = new URL(media.url)
  const playerPath = parseBandcampEmbedPath(url)
  if (playerPath === null) return null

  return {
    provider: media.provider,
    src: playerPath,
    title: 'Bandcamp player',
    height: 470,
    allow: 'autoplay'
  }
}

function youtubeEmbed(media: ExternalMediaReference): ExternalMediaEmbed | null {
  const id = new URL(media.url).searchParams.get('v')
  if (id === null || !youtubeIdPattern.test(id)) return null

  return {
    provider: media.provider,
    src: `https://www.youtube.com/embed/${id}`,
    title: 'YouTube video player',
    height: 315,
    allow:
      'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share'
  }
}

function parseBandcampEmbedPath(url: URL): string | null {
  if (url.hostname.toLowerCase() !== 'bandcamp.com') return null

  const match = bandcampEmbedPattern.exec(url.pathname)
  if (match === null) return null

  const type = match[1]
  const id = match[2]
  if (type === undefined || id === undefined) return null

  return `https://bandcamp.com/EmbeddedPlayer/${type}=${id}/size=large/bgcol=ffffff/linkcol=0687f5/tracklist=false/transparent=true/`
}

function youTubeVideoId(url: URL): string | null {
  const host = url.hostname.toLowerCase()
  const segments = pathSegments(url)

  if (host === 'youtu.be') return segments.length === 1 ? (segments[0] ?? null) : null
  if (segments[0] === 'watch') return segments.length === 1 ? url.searchParams.get('v') : null
  if (segments[0] === 'embed' || segments[0] === 'shorts') {
    return segments.length === 2 ? (segments[1] ?? null) : null
  }

  return null
}

function pathSegments(url: URL): string[] {
  const segments: string[] = []

  for (const segment of url.pathname.split('/')) {
    if (!segment) continue

    const decoded = decodePathSegment(segment)
    if (decoded === null) return []
    segments.push(decoded)
  }

  return segments
}

function decodePathSegment(segment: string): string | null {
  try {
    return decodeURIComponent(segment)
  } catch {
    return null
  }
}

function isSpotifyHost(host: string): boolean {
  return host === 'open.spotify.com'
}

function isSoundCloudHost(host: string): boolean {
  return host === 'soundcloud.com' || host === 'www.soundcloud.com' || host === 'm.soundcloud.com'
}

function isBandcampHost(host: string): boolean {
  return host === 'bandcamp.com' || host.endsWith('.bandcamp.com')
}

function isYouTubeHost(host: string): boolean {
  return (
    host === 'youtube.com' ||
    host === 'www.youtube.com' ||
    host === 'm.youtube.com' ||
    host === 'music.youtube.com' ||
    host === 'www.youtube-nocookie.com' ||
    host === 'youtu.be'
  )
}

function extractBandcampEmbedUrl(value: string): string | null {
  const match =
    /\bsrc=\\?['"](https:(?:\\?\/){2}bandcamp\.com(?:\\?\/)EmbeddedPlayer(?:\\?\/)(?:album|track)=\d+(?:\\?\/[^'"]*)?)\\?['"]/i.exec(
      value
    )
  return match?.[1] ?? null
}

function success(provider: ExternalMediaProvider, url: string): ExternalMediaParseResult {
  return { ok: true, media: { provider, url } }
}

function failure(message: string): ExternalMediaParseResult {
  return { ok: false, message }
}
