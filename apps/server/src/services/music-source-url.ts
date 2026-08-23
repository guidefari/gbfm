import { Option, Schema } from 'effect'
import type { MusicPlatform } from '@/db/music-entity.schema'

export type CanonicalMusicSourceLink = {
  readonly platform: MusicPlatform
  readonly url: string
}

const decodeUrl = Schema.decodeUnknownOption(Schema.URLFromString)
const SOURCE_ENTITY_TYPES = ['track', 'album', 'playlist'] as const

type SourceEntityType = (typeof SOURCE_ENTITY_TYPES)[number]

type ExactSource = {
  readonly platform: 'spotify' | 'deezer'
  readonly entityType: SourceEntityType
  readonly externalId: string
}

const sourceEntityType = (value: string | undefined): SourceEntityType | undefined =>
  SOURCE_ENTITY_TYPES.find((entityType) => entityType === value)

const parseSpotifySource = (url: URL): Option.Option<ExactSource> => {
  if (url.hostname !== 'spotify.com' && !url.hostname.endsWith('.spotify.com')) return Option.none()
  const [rawEntityType, externalId, ...rest] = url.pathname.split('/').filter(Boolean)
  const entityType = sourceEntityType(rawEntityType)
  return entityType && externalId && rest.length === 0
    ? Option.some({ platform: 'spotify', entityType, externalId })
    : Option.none()
}

const parseDeezerSource = (url: URL): Option.Option<ExactSource> => {
  if (url.hostname !== 'deezer.com' && !url.hostname.endsWith('.deezer.com')) return Option.none()
  const segments = url.pathname.split('/').filter(Boolean)
  const typeIndex = segments.findIndex((segment) => sourceEntityType(segment) !== undefined)
  const entityType = sourceEntityType(segments[typeIndex])
  const externalId = segments[typeIndex + 1]
  return entityType && externalId && /^\d+$/.test(externalId) && typeIndex + 2 === segments.length
    ? Option.some({ platform: 'deezer', entityType, externalId })
    : Option.none()
}

const canonicalExactSource = (url: URL): Option.Option<CanonicalMusicSourceLink> =>
  Option.firstSomeOf([parseSpotifySource(url), parseDeezerSource(url)]).pipe(
    Option.map((source) => ({
      platform: source.platform,
      url:
        source.platform === 'spotify'
          ? `https://open.spotify.com/${source.entityType}/${source.externalId}`
          : `https://www.deezer.com/${source.entityType}/${source.externalId}`
    }))
  )

const canonicalYouTubeSource = (url: URL): Option.Option<CanonicalMusicSourceLink> => {
  const segments = url.pathname.split('/').filter(Boolean)
  const externalId =
    url.hostname === 'youtu.be'
      ? segments[0]
      : url.hostname === 'youtube.com' || url.hostname === 'www.youtube.com'
        ? (url.searchParams.get('v') ?? (segments[0] === 'embed' ? segments[1] : undefined))
        : undefined
  return externalId
    ? Option.some({
        platform: 'youtube',
        url: `https://www.youtube.com/watch?v=${externalId}`
      })
    : Option.none()
}

const isDomain = (hostname: string, domain: string) =>
  hostname === domain || hostname.endsWith(`.${domain}`)

const platformForHostname = (hostname: string): MusicPlatform => {
  if (isDomain(hostname, 'bandcamp.com')) return 'bandcamp'
  if (isDomain(hostname, 'soundcloud.com')) return 'soundcloud'
  if (isDomain(hostname, 'music.apple.com')) return 'apple_music'
  if (isDomain(hostname, 'youtube.com') || hostname === 'youtu.be') return 'youtube'
  if (isDomain(hostname, 'tidal.com')) return 'tidal'
  if (isDomain(hostname, 'deezer.com')) return 'deezer'
  if (isDomain(hostname, 'amazon.com')) return 'amazon_music'
  return 'other'
}

export const canonicalizeMusicSourceLink = (source: string): CanonicalMusicSourceLink =>
  decodeUrl(source).pipe(
    Option.map((url) => {
      const knownSource = Option.firstSomeOf([
        canonicalExactSource(url),
        canonicalYouTubeSource(url)
      ])
      if (Option.isSome(knownSource)) return knownSource.value

      url.hash = ''
      return { platform: platformForHostname(url.hostname.toLowerCase()), url: url.toString() }
    }),
    Option.getOrElse((): CanonicalMusicSourceLink => ({ platform: 'other', url: source }))
  )
