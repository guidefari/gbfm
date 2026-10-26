/* oxlint-disable anti-slop-effect/no-manual-tagged-construction -- ExternalMediaEmbed is a member of a Schema-owned recursive union without generated constructors. */
import type { ExternalMediaProvider, RichContentBlock, SafeUrl } from './schema.ts'

/**
 * Provider recognition shared by the source parser, the server renderer, and the composer, so
 * every layer accepts exactly the media links the renderer can turn into a player.
 */
export type MediaProvider = typeof ExternalMediaProvider.Type

export type ExternalMediaEmbed = Extract<RichContentBlock, { readonly _tag: 'ExternalMediaEmbed' }>

export interface MediaReference {
  readonly provider: MediaProvider
  /** Spotify catalog kind, which can also be authored as attached music. */
  readonly musicType?: 'track' | 'album' | 'playlist'
  /** A Bandcamp release page whose numeric player ID must be read from the page itself. */
  readonly bandcampPage?: 'track' | 'album'
}

export const mediaProviderLabels: Readonly<Record<MediaProvider, string>> = {
  youtube: 'YouTube',
  soundcloud: 'SoundCloud',
  bandcamp: 'Bandcamp',
  spotify: 'Spotify',
}

export const SUPPORTED_MEDIA_HINT =
  'Use a YouTube video, SoundCloud track or set, Bandcamp track or album, or Spotify link.'

const youtubeHosts = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
])

const isBandcampHost = (host: string) => host === 'bandcamp.com' || host.endsWith('.bandcamp.com')

export const mediaReference = (url: URL): MediaReference | null => {
  const host = url.hostname.toLowerCase()
  const parts = url.pathname.split('/').filter(Boolean)

  if (host === 'open.spotify.com' && parts.length === 2) {
    const kind = parts[0]

    if (kind === 'track' || kind === 'album' || kind === 'playlist')
      return { provider: 'spotify', musicType: kind }

    if (kind === 'episode' || kind === 'show') return { provider: 'spotify' }
  }

  if (
    youtubeHosts.has(host) &&
    ((parts[0] === 'watch' && url.searchParams.has('v')) ||
      ((parts[0] === 'embed' || parts[0] === 'shorts' || parts[0] === 'live') &&
        parts.length === 2))
  )
    return { provider: 'youtube' }

  if (host === 'youtu.be' && parts.length === 1) return { provider: 'youtube' }

  if ((host === 'soundcloud.com' || host.endsWith('.soundcloud.com')) && parts.length >= 2)
    return { provider: 'soundcloud' }

  if (isBandcampHost(host) && parts.length === 2 && (parts[0] === 'track' || parts[0] === 'album'))
    return { provider: 'bandcamp', bandcampPage: parts[0] }

  if (host === 'bandcamp.com' && parts[0] === 'EmbeddedPlayer') return { provider: 'bandcamp' }

  return null
}

export const BANDCAMP_PLAYER_HEIGHT = 120

const BANDCAMP_LIGHT_COLORS = '/bgcol=ffffff/linkcol=0687f5/'

const BANDCAMP_DARK_COLORS = '/bgcol=333333/linkcol=4ec5ec/'

/** Bandcamp's compact horizontal player: small artwork, title, and transport in one row. */
export const bandcampPlayerUrl = (kind: 'track' | 'album', id: string) =>
  `https://bandcamp.com/EmbeddedPlayer/${kind}=${encodeURIComponent(id)}/size=large${BANDCAMP_LIGHT_COLORS}tracklist=false/artwork=small/transparent=true/`

/**
 * Bandcamp colours its player from URL parameters rather than the page's colour scheme, so the
 * dark theme needs its own address. Returns null for players that were not built here.
 */
export const bandcampDarkPlayerUrl = (embedUrl: string) =>
  embedUrl.startsWith('https://bandcamp.com/EmbeddedPlayer/') &&
  embedUrl.includes(BANDCAMP_LIGHT_COLORS)
    ? embedUrl.replace(BANDCAMP_LIGHT_COLORS, BANDCAMP_DARK_COLORS)
    : null

const embed = (
  provider: MediaProvider,
  canonicalUrl: SafeUrl,
  embedUrl: string,
  title: string,
  aspectRatio: number,
): ExternalMediaEmbed => ({
  _tag: 'ExternalMediaEmbed',
  provider,
  canonicalUrl,
  embedUrl,
  title,
  aspectRatio,
})

/**
 * Derives a player for links whose embed address is computable from the URL alone. Bandcamp
 * release pages return null because their player needs the page's numeric item ID.
 */
export const directMediaEmbed = (url: SafeUrl): ExternalMediaEmbed | null => {
  const parsed = new URL(url)
  const reference = mediaReference(parsed)
  const parts = parsed.pathname.split('/').filter(Boolean)

  if (!reference) return null

  if (reference.provider === 'youtube') {
    const videoId =
      parsed.hostname === 'youtu.be'
        ? parts[0]
        : (parsed.searchParams.get('v') ?? (parts[0] === 'watch' ? undefined : parts[1]))

    return videoId
      ? embed(
          'youtube',
          url,
          `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}`,
          'YouTube video',
          16 / 9,
        )
      : null
  }

  if (reference.provider === 'soundcloud')
    return embed(
      'soundcloud',
      url,
      `https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}&visual=false`,
      'SoundCloud player',
      16 / 5,
    )

  if (reference.provider === 'spotify')
    return embed(
      'spotify',
      url,
      `https://open.spotify.com/embed/${parts[0]}/${encodeURIComponent(parts[1] ?? '')}`,
      'Spotify player',
      16 / 9,
    )

  if (reference.bandcampPage) return null

  return embed('bandcamp', url, url, 'Bandcamp player', 16 / 5)
}

export const bandcampMediaEmbed = (
  canonicalUrl: SafeUrl,
  item: { readonly kind: 'track' | 'album'; readonly id: string; readonly title: string | null },
): ExternalMediaEmbed =>
  embed(
    'bandcamp',
    canonicalUrl,
    bandcampPlayerUrl(item.kind, item.id),
    item.title ?? 'Bandcamp player',
    16 / 5,
  )
