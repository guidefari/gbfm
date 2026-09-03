import { Effect, Option, Schema } from 'effect'
import type { MusicPlatform } from '@/db/music-entity.schema'
import { MusicSourceInvalid } from './errors'

export const CANONICAL_MUSIC_ENTITY_TYPES = ['artist', 'album', 'track', 'playlist'] as const
export type CanonicalMusicEntityType = (typeof CANONICAL_MUSIC_ENTITY_TYPES)[number]

export type MusicSourceEntityType = CanonicalMusicEntityType | 'video' | 'url'

export type ParsedMusicSource = {
  readonly sourceKey: string
  readonly platform: MusicPlatform
  readonly sourceEntityType: MusicSourceEntityType
  readonly externalId: string | null
  readonly canonicalUrl: string
  readonly normalizedUrl: string
}

type ProviderSource = {
  readonly platform: 'spotify' | 'deezer' | 'youtube'
  readonly sourceEntityType: Exclude<MusicSourceEntityType, 'url'>
  readonly expectedEntityType: CanonicalMusicEntityType
  readonly externalId: string
  readonly canonicalUrl: string
}

const MAX_URL_LENGTH = 2048
const MAX_EXTERNAL_ID_LENGTH = 256
const TRACKING_PARAMETERS = new Set([
  'dclid',
  'fbclid',
  'gclid',
  'mc_cid',
  'mc_eid',
  'msclkid',
  'si'
])
const KNOWN_PROVIDER_DOMAINS = ['spotify.com', 'deezer.com', 'youtube.com', 'youtu.be'] as const
const decodeUrl = Schema.decodeUnknownOption(Schema.URLFromString)

const invalid = (reason: MusicSourceInvalid['reason'], message: string) =>
  new MusicSourceInvalid({ reason, message })

const normalizeHostname = (hostname: string) => hostname.toLowerCase().replace(/\.$/, '')

const isDomain = (hostname: string, domain: string) => {
  const normalized = normalizeHostname(hostname)
  return normalized === domain || normalized.endsWith(`.${domain}`)
}

const sourceEntityType = (value: string | undefined): CanonicalMusicEntityType | undefined =>
  CANONICAL_MUSIC_ENTITY_TYPES.find((entityType) => entityType === value)

const hasProviderLookalikeHostname = (hostname: string) => {
  const normalized = normalizeHostname(hostname)
  return KNOWN_PROVIDER_DOMAINS.some(
    (domain) => normalized.includes(domain) && !isDomain(normalized, domain)
  )
}

const ipv4Octets = (hostname: string): ReadonlyArray<number> | undefined => {
  const values = hostname.split('.').map(Number)
  if (
    values.length !== 4 ||
    values.some((value) => !Number.isInteger(value) || value < 0 || value > 255)
  ) {
    return undefined
  }
  return values
}

const isPrivateIpv4 = (hostname: string) => {
  const octets = ipv4Octets(hostname)
  if (!octets) return false
  const first = octets[0]
  const second = octets[1]
  if (first === undefined || second === undefined) return true

  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && (second === 0 || second === 168)) ||
    (first === 198 && (second === 18 || second === 19)) ||
    first >= 224
  )
}

const isPrivateIpv6 = (hostname: string) => {
  const address = hostname.replace(/^\[|\]$/g, '').toLowerCase()
  if (!address.includes(':')) return false
  if (address === '::' || address === '::1') return true
  if (address.startsWith('fc') || address.startsWith('fd')) return true
  if (/^fe[89abcdef]/.test(address)) return true
  if (address.startsWith('ff') || address.startsWith('2001:db8:')) return true
  if (address.startsWith('::ffff:')) return true
  return false
}

const isUnsafeHostname = (hostname: string) => {
  const normalized = normalizeHostname(hostname)
  return (
    normalized === 'localhost' ||
    normalized.endsWith('.localhost') ||
    normalized.endsWith('.local') ||
    normalized.endsWith('.internal') ||
    normalized === 'metadata.google.internal' ||
    isPrivateIpv4(normalized) ||
    isPrivateIpv6(normalized)
  )
}

const hasControlCharacter = (value: string) =>
  Array.from(value).some((character) => {
    const code = character.charCodeAt(0)
    return code <= 31 || code === 127
  })

const normalizeUrl = (url: URL) => {
  const normalized = new URL(url.toString())
  const trackingKeys = new Set<string>()
  normalized.hash = ''
  normalized.searchParams.forEach((_value, key) => {
    const lowercaseKey = key.toLowerCase()
    if (lowercaseKey.startsWith('utm_') || TRACKING_PARAMETERS.has(lowercaseKey)) {
      trackingKeys.add(key)
    }
  })
  for (const key of trackingKeys) normalized.searchParams.delete(key)
  normalized.searchParams.sort()
  return normalized.toString()
}

const validExternalId = (externalId: string | undefined, pattern: RegExp): externalId is string =>
  externalId !== undefined &&
  externalId.length > 0 &&
  externalId.length <= MAX_EXTERNAL_ID_LENGTH &&
  pattern.test(externalId)

const parseSpotify = (url: URL): ProviderSource | undefined => {
  if (!isDomain(url.hostname, 'spotify.com')) return undefined
  const segments = url.pathname.split('/').filter(Boolean)
  const prefix = segments[0]
  if (prefix === 'embed' || /^intl-[a-z]{2}$/i.test(prefix ?? '')) segments.shift()
  const [rawType, externalId, ...rest] = segments
  const entityType = sourceEntityType(rawType)
  if (!entityType || !validExternalId(externalId, /^[A-Za-z0-9]+$/) || rest.length > 0) {
    return undefined
  }
  return {
    platform: 'spotify',
    sourceEntityType: entityType,
    expectedEntityType: entityType,
    externalId,
    canonicalUrl: `https://open.spotify.com/${entityType}/${externalId}`
  }
}

const parseDeezer = (url: URL): ProviderSource | undefined => {
  if (!isDomain(url.hostname, 'deezer.com')) return undefined
  const segments = url.pathname.split('/').filter(Boolean)
  const typeIndex = segments.findIndex((segment) => sourceEntityType(segment) !== undefined)
  const hasValidPrefix =
    typeIndex === 0 || (typeIndex === 1 && /^[a-z]{2}(?:-[a-z]{2})?$/i.test(segments[0] ?? ''))
  const entityType = sourceEntityType(segments[typeIndex])
  const externalId = segments[typeIndex + 1]
  if (
    !hasValidPrefix ||
    !entityType ||
    !validExternalId(externalId, /^\d+$/) ||
    typeIndex + 2 !== segments.length
  ) {
    return undefined
  }
  return {
    platform: 'deezer',
    sourceEntityType: entityType,
    expectedEntityType: entityType,
    externalId,
    canonicalUrl: `https://www.deezer.com/${entityType}/${externalId}`
  }
}

const parseYouTube = (url: URL): ProviderSource | undefined => {
  const isShortUrl = url.hostname === 'youtu.be'
  if (!isShortUrl && !isDomain(url.hostname, 'youtube.com')) return undefined
  const segments = url.pathname.split('/').filter(Boolean)
  const videoId = isShortUrl
    ? segments.length === 1
      ? segments[0]
      : undefined
    : url.pathname === '/watch'
      ? (url.searchParams.get('v') ?? undefined)
      : segments.length === 2 && ['embed', 'shorts'].includes(segments[0] ?? '')
        ? segments[1]
        : undefined
  if (validExternalId(videoId, /^[A-Za-z0-9_-]+$/)) {
    return {
      platform: 'youtube',
      sourceEntityType: 'video',
      expectedEntityType: 'track',
      externalId: videoId,
      canonicalUrl: `https://www.youtube.com/watch?v=${videoId}`
    }
  }

  const playlistId =
    url.pathname === '/playlist' ? (url.searchParams.get('list') ?? undefined) : undefined
  if (!validExternalId(playlistId, /^[A-Za-z0-9_-]+$/)) return undefined
  return {
    platform: 'youtube',
    sourceEntityType: 'playlist',
    expectedEntityType: 'playlist',
    externalId: playlistId,
    canonicalUrl: `https://www.youtube.com/playlist?list=${playlistId}`
  }
}

const parseProvider = (url: URL): ProviderSource | undefined =>
  parseSpotify(url) ?? parseDeezer(url) ?? parseYouTube(url)

const platformForHostname = (hostname: string): MusicPlatform => {
  if (isDomain(hostname, 'bandcamp.com')) return 'bandcamp'
  if (isDomain(hostname, 'soundcloud.com')) return 'soundcloud'
  if (isDomain(hostname, 'music.apple.com')) return 'apple_music'
  if (isDomain(hostname, 'tidal.com')) return 'tidal'
  if (isDomain(hostname, 'amazon.com')) return 'amazon_music'
  return 'other'
}

const digestUrl = (normalizedUrl: string) =>
  Effect.tryPromise({
    try: () => crypto.subtle.digest('SHA-256', new TextEncoder().encode(normalizedUrl)),
    catch: () => invalid('digest_failed', 'Could not derive the source key')
  }).pipe(
    Effect.map((digest) =>
      Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
    )
  )

export const parseMusicSource = (
  source: string,
  expectedType?: CanonicalMusicEntityType
): Effect.Effect<ParsedMusicSource, MusicSourceInvalid> => {
  if (source.length > MAX_URL_LENGTH) {
    return Effect.fail(invalid('too_long', 'Music source URL is too long'))
  }
  if (hasControlCharacter(source)) {
    return Effect.fail(invalid('control_character', 'Music source URL contains control characters'))
  }

  const decodedUrl = decodeUrl(source)
  if (Option.isNone(decodedUrl)) {
    return Effect.fail(invalid('invalid_url', 'Music source must be a valid URL'))
  }

  const url = decodedUrl.value
  if (url.protocol !== 'https:') {
    return Effect.fail(invalid('unsupported_protocol', 'Music source must use HTTPS'))
  }
  if (url.username || url.password) {
    return Effect.fail(invalid('credentials', 'Music source must not contain credentials'))
  }

  const hostname = normalizeHostname(url.hostname)
  if (isUnsafeHostname(hostname) || hasProviderLookalikeHostname(hostname)) {
    return Effect.fail(invalid('unsafe_destination', 'Music source destination is not allowed'))
  }

  const normalizedUrl = normalizeUrl(url)
  const provider = parseProvider(url)
  if (KNOWN_PROVIDER_DOMAINS.some((domain) => isDomain(hostname, domain)) && !provider) {
    return Effect.fail(invalid('invalid_provider_source', 'Music provider URL is not supported'))
  }
  if (provider) {
    if (expectedType && expectedType !== provider.expectedEntityType) {
      return Effect.fail(
        invalid('type_mismatch', 'Music source type does not match the expected type')
      )
    }
    return Effect.succeed({
      sourceKey: `${provider.platform}:${provider.sourceEntityType}:${provider.externalId}`,
      platform: provider.platform,
      sourceEntityType: provider.sourceEntityType,
      externalId: provider.externalId,
      canonicalUrl: provider.canonicalUrl,
      normalizedUrl
    })
  }

  return digestUrl(normalizedUrl).pipe(
    Effect.map((digest) => ({
      sourceKey: `url:sha256:${digest}`,
      platform: platformForHostname(hostname),
      sourceEntityType: expectedType ?? 'url',
      externalId: null,
      canonicalUrl: normalizedUrl,
      normalizedUrl
    }))
  )
}
