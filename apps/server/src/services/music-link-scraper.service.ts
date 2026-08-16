/**
 * Music Link Scraper Service
 *
 * Provider-first design: a `MusicDataProvider` interface defines the contract.
 * Any number of providers can be plugged in; the scraper service orchestrates
 * them and merges results. Later providers override earlier ones for the same
 * platform so the ordering matters.
 *
 * Built-in providers:
 *   OdesliProvider: free, no API key; converts one streaming URL to 15+
 *                         platform links (Spotify, Apple Music, YouTube Music,
 *                         Tidal, Bandcamp, SoundCloud, etc.)
 *   FirecrawlProvider: optional (FIRECRAWL_API_KEY); AI-powered page
 *                         scraper for artist pages; good for Discord, social
 *                         links that Odesli doesn't cover
 *   MusicBrainzIdentityService: canonical identity for exact MBIDs and ISRCs
 *
 * Adding a new provider:
 *   1. Implement MusicDataProvider
 *   2. Add it to the providers array in MusicLinkScraperServiceLayer
 */

import { Context, Data, Effect, Layer, Schedule, Schema } from 'effect'
import { getErrorMessage } from '@/errors'
import { extractBandcampArtist, getBandcampMetadataWithSpan } from '@/services/bandcamp.service'
import {
  DeezerService,
  type DeezerAlbumCandidate,
  type DeezerError,
  type DeezerSourceCandidate,
  type DeezerTrackCandidate
} from '@/services/deezer.service'
import { isBandcampUrl } from '@/services/url-utils'
import {
  SpotifyService,
  type SpotifyServiceError,
  type SpotifySourceCandidate
} from '@/services/spotify.service'
import {
  type CoverArtArchiveReference,
  MusicBrainzIdentityService,
  type MusicBrainzIdentityCandidate,
  type MusicBrainzIdentityError,
  type MusicBrainzIdentityServiceContract,
  type MusicBrainzMbidType
} from '@/services/musicbrainz-identity.service'
import type { InsertMusicEntityLink, MusicPlatform } from '../db/music-entity.schema'

// ---------------------------------------------------------------------------
// Error type
// ---------------------------------------------------------------------------

export class MusicScraperError extends Data.TaggedError('MusicScraperError')<{
  readonly message: string
  readonly provider: string
  readonly statusCode?: number
}> {}

// ---------------------------------------------------------------------------
// Shared data types
// ---------------------------------------------------------------------------

export interface MusicScrapeInput {
  entityType?: 'artist' | 'album' | 'track' | 'playlist'
  /** Any streaming URL (Spotify, Bandcamp, Apple Music, YouTube, etc.) */
  url?: string
  /** Artist name for text-based lookups (e.g. MusicBrainz) */
  artistName?: string
  albumTitle?: string
  trackTitle?: string
  /** MusicBrainz ID when known */
  mbid?: string
  /** International Standard Recording Code when known */
  isrc?: string
}

export interface MusicScrapeOptions {
  readonly signal?: AbortSignal
}

export interface ScrapedLink {
  platform: MusicPlatform
  url: string
  scrapedAt: Date
  metadata?: InsertMusicEntityLink['metadata']
}

export interface EntityMeta {
  title?: string
  artistName?: string
  thumbnailUrl?: string
  type?: 'song' | 'album' | 'artist' | 'playlist'
  isrc?: string
}

export interface ProviderResult {
  links: ScrapedLink[]
  entityMeta?: EntityMeta
}

export interface ScrapeResult {
  links: ScrapedLink[]
  entityMeta?: EntityMeta
}

// ---------------------------------------------------------------------------
// Provider interface for adding a new data source
// ---------------------------------------------------------------------------

export interface MusicDataProvider {
  /**
   * Unique human-readable name shown in logs and error messages.
   */
  readonly name: string

  /**
   * Fetch platform links for the given input. Return an empty array if this
   * provider doesn't handle the input (e.g. no URL provided for a URL-only
   * provider). Signal errors through Effect failure.
   */
  readonly fetchLinks: (
    input: MusicScrapeInput,
    options?: MusicScrapeOptions
  ) => Effect.Effect<ProviderResult, MusicScraperError>
}

export interface CrossPlatformLinkDiscovery {
  readonly name: string
  readonly discoverLinks: (
    input: MusicScrapeInput,
    options?: MusicScrapeOptions
  ) => Effect.Effect<ProviderResult, MusicScraperError>
}

// ---------------------------------------------------------------------------
// Odesli / song.link provider
//   Docs: https://odesli.co (no auth required for reasonable usage)
// ---------------------------------------------------------------------------

const ODESLI_PLATFORM_MAP = new Map<string, MusicPlatform>([
  ['spotify', 'spotify'],
  ['youtube', 'youtube'],
  ['youtubeMusic', 'youtube_music'],
  ['appleMusic', 'apple_music'],
  ['tidal', 'tidal'],
  ['deezer', 'deezer'],
  ['amazonMusic', 'amazon_music'],
  ['soundcloud', 'soundcloud'],
  ['bandcamp', 'bandcamp']
])

interface OdesliPlatformLink {
  country: string
  url: string
  nativeAppUriMobile?: string
  nativeAppUriDesktop?: string
  entityUniqueId: string
}

interface OdesliEntity {
  id: string
  type: 'song' | 'album'
  title?: string
  artistName?: string
  thumbnailUrl?: string
  apiProvider: string
  platforms: readonly string[]
}

interface OdesliResponse {
  entityUniqueId: string
  userCountry: string
  pageUrl: string
  linksByPlatform: Record<string, OdesliPlatformLink>
  entitiesByUniqueId: Record<string, OdesliEntity>
}

const OdesliPlatformLinkSchema = Schema.Struct({
  country: Schema.String,
  url: Schema.String,
  nativeAppUriMobile: Schema.optional(Schema.String),
  nativeAppUriDesktop: Schema.optional(Schema.String),
  entityUniqueId: Schema.String
})

const OdesliEntitySchema = Schema.Struct({
  id: Schema.String,
  type: Schema.Union([Schema.Literal('song'), Schema.Literal('album')]),
  title: Schema.optional(Schema.String),
  artistName: Schema.optional(Schema.String),
  thumbnailUrl: Schema.optional(Schema.String),
  apiProvider: Schema.String,
  platforms: Schema.Array(Schema.String)
})

const OdesliResponseSchema = Schema.Struct({
  entityUniqueId: Schema.String,
  userCountry: Schema.String,
  pageUrl: Schema.String,
  linksByPlatform: Schema.Record(Schema.String, OdesliPlatformLinkSchema),
  entitiesByUniqueId: Schema.Record(Schema.String, OdesliEntitySchema)
})

const decodeOdesliResponse = Schema.decodeUnknownSync(OdesliResponseSchema)

export class OdesliProvider implements CrossPlatformLinkDiscovery {
  readonly name = 'odesli'

  discoverLinks(
    input: MusicScrapeInput,
    options: MusicScrapeOptions = {}
  ): Effect.Effect<ProviderResult, MusicScraperError> {
    if (!input.url) return Effect.succeed({ links: [] })

    const seedUrl = input.url
    return Effect.gen(function* () {
      const encoded = encodeURIComponent(seedUrl)
      const apiUrl = `https://api.song.link/v1-alpha.1/links?url=${encoded}&userCountry=US`

      const response = yield* Effect.tryPromise({
        try: (signal) =>
          fetch(apiUrl, {
            signal: options.signal ? AbortSignal.any([signal, options.signal]) : signal
          }),
        catch: (err) =>
          new MusicScraperError({
            message: `Odesli fetch failed: ${getErrorMessage(err)}`,
            provider: 'odesli',
            statusCode: 502
          })
      })

      if (response.status === 404) {
        return { links: [] } satisfies ProviderResult
      }

      if (!response.ok) {
        return yield* new MusicScraperError({
          message: `Odesli returned ${response.status}`,
          provider: 'odesli',
          statusCode: response.status
        })
      }

      const data: OdesliResponse = yield* Effect.tryPromise({
        try: () => decodeResponseJson(response, decodeOdesliResponse),
        catch: (err) =>
          new MusicScraperError({
            message: `Odesli JSON parse failed: ${getErrorMessage(err)}`,
            provider: 'odesli',
            statusCode: 500
          })
      })

      const scrapedAt = new Date()

      const links: ScrapedLink[] = Object.entries(data.linksByPlatform).flatMap(
        ([key, platformData]) => {
          const platform = ODESLI_PLATFORM_MAP.get(key)
          if (!platform) return []
          const metadata: NonNullable<ScrapedLink['metadata']> = {
            odesliEntityId: platformData.entityUniqueId,
            discoveredBy: 'odesli',
            confidence: 'cross_platform'
          }
          if (platformData.nativeAppUriMobile) {
            metadata.nativeAppUriMobile = platformData.nativeAppUriMobile
          }
          if (platformData.nativeAppUriDesktop) {
            metadata.nativeAppUriDesktop = platformData.nativeAppUriDesktop
          }
          return [
            {
              platform,
              url: platformData.url,
              scrapedAt,
              metadata
            } satisfies ScrapedLink
          ]
        }
      )

      const primaryEntity =
        data.entitiesByUniqueId[data.entityUniqueId] ?? Object.values(data.entitiesByUniqueId)[0]

      const entityMeta: EntityMeta | undefined = primaryEntity
        ? {
            title: primaryEntity.title,
            artistName: primaryEntity.artistName,
            thumbnailUrl: primaryEntity.thumbnailUrl,
            type: primaryEntity.type === 'song' ? 'song' : 'album'
          }
        : undefined

      return { links, entityMeta } satisfies ProviderResult
    }).pipe(
      Effect.retry({
        schedule: Schedule.exponential('2 seconds').pipe(Schedule.upTo({ times: 5 })),
        while: (err) => err.statusCode === 429
      }),
      Effect.timeout('15 seconds'),
      Effect.catchTag('TimeoutError', () =>
        Effect.fail(
          new MusicScraperError({
            message: 'Odesli request timed out after 15 seconds',
            provider: 'odesli',
            statusCode: 504
          })
        )
      ),
      Effect.withSpan('musicScraper.odesli', {
        attributes: { 'scraper.seed_host': urlHostname(seedUrl) }
      })
    )
  }
}

// ---------------------------------------------------------------------------
// Firecrawl provider
//   Docs: https://firecrawl.dev, requires FIRECRAWL_API_KEY
//   Use case: scrape artist / label pages for social + Discord links that
//   Odesli doesn't know about.
// ---------------------------------------------------------------------------

interface FirecrawlExtractResult {
  socialLinks?: Partial<Record<string, string>>
}

const FirecrawlExtractResultSchema = Schema.Struct({
  socialLinks: Schema.optional(Schema.Record(Schema.String, Schema.String))
})

const decodeFirecrawlExtractResult = Schema.decodeUnknownSync(FirecrawlExtractResultSchema)

type JsonInput = Parameters<typeof decodeOdesliResponse>[0]
type JsonDecoder<T> = (raw: JsonInput) => T

async function decodeResponseJson<T>(response: Response, decode: JsonDecoder<T>): Promise<T> {
  const raw: unknown = JSON.parse(await response.text())
  return decode(raw)
}

export class FirecrawlProvider implements MusicDataProvider {
  readonly name = 'firecrawl'

  constructor(private readonly apiKey: string) {}

  fetchLinks(
    input: MusicScrapeInput,
    options: MusicScrapeOptions = {}
  ): Effect.Effect<ProviderResult, MusicScraperError> {
    if (!input.url) return Effect.succeed({ links: [] })

    const pageUrl = input.url
    const apiKey = this.apiKey

    return Effect.gen(function* () {
      const response = yield* Effect.tryPromise({
        try: (signal) =>
          fetch('https://api.firecrawl.dev/v1/extract', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              urls: [pageUrl],
              prompt:
                'Extract all music streaming and social media links from this page. ' +
                'Look for: Spotify, Apple Music, YouTube, Bandcamp, SoundCloud, Tidal, ' +
                'Deezer, Amazon Music, Discord server links, Instagram, Twitter/X.',
              schema: {
                type: 'object',
                properties: {
                  socialLinks: {
                    type: 'object',
                    description: 'Streaming and social links keyed by platform name',
                    additionalProperties: { type: 'string' }
                  }
                }
              }
            }),
            signal: options.signal ? AbortSignal.any([signal, options.signal]) : signal
          }),
        catch: (err) =>
          new MusicScraperError({
            message: `Firecrawl fetch failed: ${getErrorMessage(err)}`,
            provider: 'firecrawl',
            statusCode: 502
          })
      })

      if (!response.ok) {
        yield* Effect.logWarning(
          `[firecrawl] ${response.status} for ${urlHostname(pageUrl)}, skipping`
        )
        return { links: [] } satisfies ProviderResult
      }

      const data: FirecrawlExtractResult = yield* Effect.tryPromise({
        try: () => decodeResponseJson(response, decodeFirecrawlExtractResult),
        catch: () =>
          new MusicScraperError({
            message: 'Firecrawl JSON parse failed',
            provider: 'firecrawl',
            statusCode: 500
          })
      })

      const scrapedAt = new Date()
      const links: ScrapedLink[] = []

      for (const [key, url] of Object.entries(data.socialLinks ?? {})) {
        if (!url) continue
        links.push({ platform: mapToPlatform(key), url, scrapedAt })
      }

      return { links } satisfies ProviderResult
    }).pipe(
      Effect.withSpan('musicScraper.firecrawl', {
        attributes: { 'scraper.page_host': urlHostname(pageUrl) }
      })
    )
  }
}

// ---------------------------------------------------------------------------
// Bandcamp provider
//   Scrapes the JSON-LD embedded in a Bandcamp page for title/artist/ISRC.
//   Bandcamp isn't itself a cross-platform link source. Odesli currently
//   fails to resolve most Bandcamp URLs directly (could_not_fetch_entity_data)
//   fails to resolve most Bandcamp URLs, so this provider only supplies entityMeta.
//   uses that metadata (isrc for tracks, title+artist for albums) to find a
//   Spotify URL, then re-runs Odesli against that URL for full coverage.
// ---------------------------------------------------------------------------

export class BandcampProvider implements MusicDataProvider {
  readonly name = 'bandcamp'

  fetchLinks(input: MusicScrapeInput): Effect.Effect<ProviderResult, MusicScraperError> {
    if (!input.url || !isBandcampUrl(input.url)) return Effect.succeed({ links: [] })

    const url = input.url
    return Effect.gen(function* () {
      const metadata = yield* getBandcampMetadataWithSpan(url).pipe(
        Effect.catchTag('SpotifyError', (err) =>
          Effect.fail(
            new MusicScraperError({
              message: `Bandcamp scrape failed: ${err.message}`,
              provider: 'bandcamp',
              statusCode: 502
            })
          )
        )
      )

      const entityMeta: EntityMeta = {
        title: metadata.name || undefined,
        artistName: extractBandcampArtist(metadata) || undefined,
        thumbnailUrl: metadata.image || undefined,
        type: metadata['@type'] === 'MusicRecording' ? 'song' : 'album',
        isrc: metadata.isrcCode
      }

      return { links: [], entityMeta } satisfies ProviderResult
    }).pipe(
      Effect.withSpan('musicScraper.bandcamp', {
        attributes: { 'scraper.seed_host': urlHostname(url) }
      })
    )
  }
}

// ---------------------------------------------------------------------------
// Service interface & implementation
// ---------------------------------------------------------------------------

export interface MusicLinkScraperService {
  /**
   * Run all configured providers against the input. Results are merged;
   * if two providers return a link for the same platform, the later one wins.
   */
  readonly scrape: (
    input: MusicScrapeInput,
    options?: MusicScrapeOptions
  ) => Effect.Effect<ScrapeResult, MusicScraperError>
  readonly discoverCrossPlatformLinks: (
    input: MusicScrapeInput,
    options?: MusicScrapeOptions
  ) => Effect.Effect<ProviderResult, MusicScraperError>
}

export const MusicLinkScraperService =
  Context.Service<MusicLinkScraperService>('MusicLinkScraperService')

const noCrossPlatformDiscovery: CrossPlatformLinkDiscovery = {
  name: 'none',
  discoverLinks: () => Effect.succeed({ links: [] })
}

export function makeMusicLinkScraperService(
  providers: MusicDataProvider[],
  spotify: SpotifyService,
  deezer: DeezerService,
  musicbrainz: MusicBrainzIdentityServiceContract,
  discovery: CrossPlatformLinkDiscovery = noCrossPlatformDiscovery
): MusicLinkScraperService {
  return {
    discoverCrossPlatformLinks: (input, options) => discovery.discoverLinks(input, options),
    scrape: Effect.fn('musicScraper.scrape')(function* (
      input: MusicScrapeInput,
      options: MusicScrapeOptions = {}
    ) {
      const platformMap = new Map<string, ScrapedLink>()
      let entityMeta: EntityMeta | undefined
      let attemptedProviders = 0
      let failedProviders = 0
      const playlist = isPlaylistInput(input)
      const source = sourceDetails(input)
      yield* interruptIfAborted(options.signal)
      const exactSource = source
        ? yield* resolveExactSource(source, input.url ?? '', spotify, deezer, options).pipe(
            Effect.catch((error) =>
              isCancellation(error, options.signal)
                ? Effect.interrupt
                : Effect.fail(sourceResolutionError(source.platform, error))
            )
          )
        : null

      if (exactSource) {
        for (const link of exactSource.links) platformMap.set(link.platform, link)
        entityMeta = exactSource.entityMeta
      }

      if (playlist) {
        return { links: [...platformMap.values()], entityMeta } satisfies ScrapeResult
      }

      if (input.url && discovery.name !== 'none') {
        attemptedProviders += 1
        const result = yield* discovery.discoverLinks(input, options).pipe(
          Effect.tap((value) => logProviderOutcome(discovery.name, providerResultOutcome(value))),
          Effect.catch((error) =>
            isCancellation(error, options.signal)
              ? Effect.interrupt
              : Effect.andThen(
                  Effect.sync(() => {
                    failedProviders += 1
                  }),
                  Effect.andThen(
                    logProviderOutcome(
                      discovery.name,
                      error.statusCode === 429 ? 'rate_limited' : 'failed'
                    ),
                    Effect.succeed({ links: [], entityMeta: undefined } satisfies ProviderResult)
                  )
                )
          )
        )
        for (const link of result.links) {
          if (exactSource && link.platform === source?.platform) continue
          platformMap.set(link.platform, link)
        }
        if (!entityMeta && result.entityMeta) entityMeta = result.entityMeta
      }

      for (const provider of providers) {
        if (!isProviderApplicable(provider, input)) continue
        yield* interruptIfAborted(options.signal)
        attemptedProviders += 1
        const result = yield* provider.fetchLinks(input, options).pipe(
          Effect.tap((value) => logProviderOutcome(provider.name, providerResultOutcome(value))),
          Effect.catch((err) =>
            isCancellation(err, options.signal)
              ? Effect.interrupt
              : Effect.andThen(
                  Effect.sync(() => {
                    failedProviders += 1
                  }),
                  Effect.andThen(
                    logProviderOutcome(
                      provider.name,
                      err.statusCode === 429 ? 'rate_limited' : 'failed'
                    ),
                    Effect.succeed({ links: [], entityMeta: undefined } satisfies ProviderResult)
                  )
                )
          )
        )

        // Later providers override earlier ones for the same platform
        for (const link of result.links) {
          if (exactSource && link.platform === source?.platform) continue
          platformMap.set(link.platform, link)
        }

        // Use the first successful entityMeta we get
        if (!entityMeta && result.entityMeta) {
          entityMeta = result.entityMeta
        }
      }

      const musicbrainzApplicable = isMusicBrainzIdentityInput(input)
      if (musicbrainzApplicable) attemptedProviders += 1
      yield* interruptIfAborted(options.signal)
      const musicbrainzResult = yield* resolveMusicBrainzIdentity(
        { ...input, isrc: input.isrc ?? entityMeta?.isrc },
        musicbrainz,
        options,
        !entityMeta?.thumbnailUrl
      ).pipe(
        Effect.tap((value) => logProviderOutcome('musicbrainz', value ? 'succeeded' : 'not_found')),
        Effect.catchTag('MusicBrainzNotFound', () =>
          Effect.andThen(logProviderOutcome('musicbrainz', 'not_found'), Effect.succeed(null))
        ),
        Effect.catch((error) =>
          isCancellation(error, options.signal)
            ? Effect.interrupt
            : Effect.andThen(
                Effect.sync(() => {
                  failedProviders += 1
                }),
                Effect.andThen(logProviderOutcome('musicbrainz', 'failed'), Effect.succeed(null))
              )
        )
      )
      if (musicbrainzResult) {
        for (const link of musicbrainzResult.links) platformMap.set(link.platform, link)
        if (!entityMeta) {
          entityMeta = musicbrainzResult.entityMeta
        } else if (!entityMeta.thumbnailUrl && musicbrainzResult.entityMeta?.thumbnailUrl) {
          entityMeta = {
            ...entityMeta,
            thumbnailUrl: musicbrainzResult.entityMeta.thumbnailUrl
          }
        }
      }

      if (!platformMap.has('spotify') && entityMeta) {
        yield* interruptIfAborted(options.signal)
        const spotifyMatch = yield* Effect.catch(
          entityMeta.type === 'album'
            ? spotify.searchAlbumByTitleArtist(
                entityMeta.title ?? '',
                entityMeta.artistName ?? '',
                options
              )
            : entityMeta.isrc
              ? spotify.searchTrackByIsrc(entityMeta.isrc, options)
              : Effect.succeed(null),
          (error) =>
            isCancellation(error, options.signal) ? Effect.interrupt : Effect.succeed(null)
        )

        if (spotifyMatch) {
          platformMap.set('spotify', {
            platform: 'spotify',
            url: spotifyMatch.url,
            scrapedAt: new Date(),
            metadata: providerMetadata(
              'spotify',
              entityMeta.type === 'album' ? 'exact_metadata' : 'exact_isrc'
            )
          })
          const odesliResult = yield* Effect.catch(
            discovery.discoverLinks({ url: spotifyMatch.url }, options),
            (error) =>
              isCancellation(error, options.signal)
                ? Effect.interrupt
                : Effect.succeed({ links: [], entityMeta: undefined } satisfies ProviderResult)
          )
          for (const link of odesliResult.links) {
            if (exactSource && link.platform === source?.platform) continue
            platformMap.set(link.platform, link)
          }
        }
      }

      if (!platformMap.has('deezer') && entityMeta) {
        yield* interruptIfAborted(options.signal)
        const deezerMatch = yield* Effect.catch(findDeezerMatch(deezer, entityMeta, options), () =>
          options.signal?.aborted ? Effect.interrupt : Effect.succeed(null)
        )

        if (deezerMatch) {
          platformMap.set('deezer', {
            platform: 'deezer',
            url: deezerMatch.url,
            scrapedAt: new Date(),
            metadata: providerMetadata('deezer', deezerMatch.match)
          })
        }
      }

      if (!exactSource && attemptedProviders > 0 && failedProviders === attemptedProviders) {
        return yield* new MusicScraperError({
          message: 'All applicable music providers are unavailable',
          provider: 'all',
          statusCode: 503
        })
      }

      return {
        links: [...platformMap.values()],
        entityMeta
      } satisfies ScrapeResult
    })
  }
}

// ---------------------------------------------------------------------------
// Live layer configuring active providers
// ---------------------------------------------------------------------------

export const MusicLinkScraperServiceLayer = Layer.effect(
  MusicLinkScraperService,
  Effect.gen(function* () {
    const spotify = yield* SpotifyService
    const deezer = yield* DeezerService
    const musicbrainz = yield* MusicBrainzIdentityService

    const providers: MusicDataProvider[] = [new BandcampProvider()]
    const discovery = new OdesliProvider()

    const firecrawlKey = process.env.FIRECRAWL_API_KEY
    if (firecrawlKey) {
      providers.push(new FirecrawlProvider(firecrawlKey))
    }

    return makeMusicLinkScraperService(providers, spotify, deezer, musicbrainz, discovery)
  })
)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mapToPlatform(key: string): MusicPlatform {
  const lower = key.toLowerCase()
  if (lower.includes('spotify')) return 'spotify'
  if (lower.includes('youtube_music') || lower === 'youtubemusic') return 'youtube_music'
  if (lower.includes('youtube')) return 'youtube'
  if (lower.includes('apple')) return 'apple_music'
  if (lower.includes('bandcamp')) return 'bandcamp'
  if (lower.includes('soundcloud')) return 'soundcloud'
  if (lower.includes('tidal')) return 'tidal'
  if (lower.includes('deezer')) return 'deezer'
  if (lower.includes('amazon')) return 'amazon_music'
  if (lower.includes('discord')) return 'discord'
  if (lower.includes('instagram')) return 'instagram'
  if (lower.includes('twitter') || lower.includes('x.com')) return 'twitter'
  if (lower.includes('musicbrainz')) return 'musicbrainz'
  return 'other'
}

function isPlaylistInput(input: MusicScrapeInput): boolean {
  if (input.entityType === 'playlist') return true
  if (!input.url) return false

  try {
    const parsed = new URL(input.url)
    return parsed.pathname.split('/').includes('playlist')
  } catch {
    return false
  }
}

type DirectSource = {
  readonly platform: 'spotify' | 'deezer'
  readonly entityType: 'track' | 'album' | 'playlist'
}

function sourceDetails(input: MusicScrapeInput): DirectSource | undefined {
  if (!input.url) return undefined
  const parsed = URL.parse(input.url)
  if (!parsed) return undefined
  const hostname = parsed.hostname.replace(/^www\./, '')
  const pathType = parsed.pathname
    .split('/')
    .find((segment) => segment === 'track' || segment === 'album' || segment === 'playlist')
  const inferredType =
    pathType === 'track' || pathType === 'album' || pathType === 'playlist' ? pathType : undefined
  const entityType = input.entityType ?? inferredType
  if (!entityType || entityType === 'artist') return undefined
  if (hostname === 'open.spotify.com' || hostname === 'spotify.com') {
    return { platform: 'spotify', entityType }
  }
  if (hostname === 'deezer.com') return { platform: 'deezer', entityType }
  return undefined
}

function providerMetadata(provider: 'spotify' | 'deezer', confidence: string, externalId?: string) {
  return { discoveredBy: provider, confidence, externalId }
}

function spotifyResult(candidate: SpotifySourceCandidate): ProviderResult {
  return {
    links: [
      {
        platform: 'spotify',
        url: candidate.url,
        scrapedAt: new Date(),
        metadata: providerMetadata('spotify', 'exact_source', candidate.externalId)
      }
    ],
    entityMeta: {
      title: candidate.title,
      artistName: candidate.entityType === 'playlist' ? candidate.ownerName : candidate.artists,
      thumbnailUrl: candidate.imageUrl,
      type: candidate.entityType === 'track' ? 'song' : candidate.entityType,
      isrc: candidate.entityType === 'track' ? candidate.isrc : undefined
    }
  }
}

function deezerResult(candidate: DeezerSourceCandidate): ProviderResult {
  return {
    links: [
      {
        platform: 'deezer',
        url: candidate.url,
        scrapedAt: new Date(),
        metadata: providerMetadata('deezer', 'exact_source', candidate.externalId)
      }
    ],
    entityMeta: {
      title: candidate.title,
      artistName: candidate.artistNames.join(', ') || undefined,
      thumbnailUrl: candidate.thumbnailUrl,
      type: candidate.entityType === 'track' ? 'song' : candidate.entityType,
      isrc: candidate.entityType === 'track' ? candidate.identifiers.isrc : undefined
    }
  }
}

function resolveExactSource(
  source: DirectSource,
  url: string,
  spotify: SpotifyService,
  deezer: DeezerService,
  options: MusicScrapeOptions
): Effect.Effect<ProviderResult, SpotifyServiceError | DeezerError> {
  return Effect.gen(function* () {
    if (source.platform === 'spotify') {
      return spotifyResult(
        yield* spotify.resolveSource({
          entityType: source.entityType,
          urlOrId: url,
          signal: options.signal
        })
      )
    }
    return deezerResult(
      yield* deezer.resolve({ entityType: source.entityType, source: url, signal: options.signal })
    )
  })
}

function findDeezerMatch(
  deezer: DeezerService,
  entityMeta: EntityMeta,
  options: MusicScrapeOptions
): Effect.Effect<DeezerTrackCandidate | DeezerAlbumCandidate | null, DeezerError> {
  if (entityMeta.type === 'album') {
    return deezer.searchAlbumByTitleArtist(
      entityMeta.title ?? '',
      entityMeta.artistName ?? '',
      options
    )
  }
  return entityMeta.isrc ? deezer.searchTrackByIsrc(entityMeta.isrc, options) : Effect.succeed(null)
}

function interruptIfAborted(signal: AbortSignal | undefined) {
  return signal?.aborted ? Effect.interrupt : Effect.void
}

function isCancellation(error: { readonly _tag: string }, signal: AbortSignal | undefined) {
  return signal?.aborted === true || error._tag === 'SpotifyRequestCancelled'
}

function sourceResolutionError(
  provider: DirectSource['platform'],
  error: SpotifyServiceError | DeezerError
) {
  const statusCode =
    error._tag === 'SpotifyError'
      ? (error.statusCode ?? 503)
      : error._tag === 'DeezerRequestFailed'
        ? (error.statusCode ?? 503)
        : error._tag === 'DeezerInvalidInput'
          ? 400
          : error._tag === 'DeezerNotFound'
            ? 404
            : 503
  return new MusicScraperError({
    message: `Exact ${provider} source could not be resolved`,
    provider,
    statusCode
  })
}

function isMusicBrainzIdentityInput(input: MusicScrapeInput) {
  const entityType = input.entityType ?? sourceDetails(input)?.entityType
  return (
    !isPlaylistInput(input) &&
    ((Boolean(input.mbid) && musicBrainzMbidType(entityType) !== null) ||
      (entityType === 'track' && Boolean(input.isrc)) ||
      Boolean(input.url && entityType))
  )
}

function isProviderApplicable(provider: MusicDataProvider, input: MusicScrapeInput) {
  if (provider.name === 'bandcamp') return Boolean(input.url && isBandcampUrl(input.url))
  if (provider.name === 'firecrawl') return Boolean(input.url)
  return true
}

type ProviderOutcome = 'succeeded' | 'not_found' | 'rate_limited' | 'failed'

function providerResultOutcome(result: ProviderResult): ProviderOutcome {
  return result.links.length > 0 || result.entityMeta ? 'succeeded' : 'not_found'
}

function logProviderOutcome(provider: string, outcome: ProviderOutcome) {
  return Effect.logInfo('Music provider attempt completed').pipe(
    Effect.annotateLogs({ provider, outcome })
  )
}

function musicBrainzMbidType(
  entityType: MusicScrapeInput['entityType']
): MusicBrainzMbidType | null {
  if (entityType === 'artist') return 'artist'
  if (entityType === 'track') return 'recording'
  if (entityType === 'album') return 'release'
  return null
}

function musicBrainzResult(
  candidate: MusicBrainzIdentityCandidate,
  coverArt?: CoverArtArchiveReference
): ProviderResult {
  const mbidType =
    candidate.entityType === 'artist'
      ? 'artist'
      : candidate.entityType === 'album'
        ? 'release-group'
        : 'recording'
  const mbid =
    candidate.entityType === 'artist'
      ? candidate.artistMbid
      : candidate.entityType === 'album'
        ? candidate.releaseGroup.mbid
        : candidate.recordingMbid
  const metadata: NonNullable<ScrapedLink['metadata']> = {
    discoveredBy: 'musicbrainz',
    confidence: candidate.provenance.confidence,
    mbid,
    mbidType,
    lookupAt: candidate.provenance.lookupAt,
    canonicalMbid: candidate.provenance.canonicalMbid
  }
  if (candidate.provenance.requestedMbid) {
    metadata.requestedMbid = candidate.provenance.requestedMbid
  }
  if (candidate.entityType === 'track' && candidate.isrcs.length > 0) {
    metadata.matchedIdentifiers = { isrcs: candidate.isrcs }
  }
  if (candidate.entityType === 'album' && candidate.editionRelease) {
    metadata.editionRelease = candidate.editionRelease
  }
  if (candidate.provenance.matchedUrl) {
    metadata.matchedUrl = candidate.provenance.matchedUrl
  }
  if (coverArt) metadata.coverArt = coverArt

  return {
    links: [
      {
        platform: 'musicbrainz',
        url: `https://musicbrainz.org/${mbidType}/${mbid}`,
        scrapedAt: new Date(candidate.provenance.lookupAt),
        metadata
      }
    ],
    entityMeta: {
      title: candidate.title,
      artistName: candidate.artistNames.join(', ') || undefined,
      type:
        candidate.entityType === 'track'
          ? 'song'
          : candidate.entityType === 'album'
            ? 'album'
            : 'artist',
      isrc: candidate.entityType === 'track' ? candidate.isrcs[0] : undefined,
      thumbnailUrl: coverArt?.imageUrl
    }
  }
}

function enrichMusicBrainzResult(
  candidate: MusicBrainzIdentityCandidate,
  musicbrainz: MusicBrainzIdentityServiceContract,
  options: MusicScrapeOptions,
  allowCoverArt: boolean
): Effect.Effect<ProviderResult, MusicBrainzIdentityError> {
  if (!allowCoverArt || candidate.entityType !== 'album' || !candidate.editionRelease) {
    return Effect.succeed(musicBrainzResult(candidate))
  }
  return musicbrainz.lookupCoverArt(candidate.editionRelease.mbid, { signal: options.signal }).pipe(
    Effect.map((coverArt) => musicBrainzResult(candidate, coverArt)),
    Effect.catch(() =>
      options.signal?.aborted ? Effect.interrupt : Effect.succeed(musicBrainzResult(candidate))
    )
  )
}

function resolveMusicBrainzIdentity(
  input: MusicScrapeInput,
  musicbrainz: MusicBrainzIdentityServiceContract,
  options: MusicScrapeOptions,
  allowCoverArt: boolean
): Effect.Effect<ProviderResult | null, MusicBrainzIdentityError> {
  if (isPlaylistInput(input)) return Effect.succeed(null)

  if (input.mbid) {
    const mbid = input.mbid
    const mbidType = musicBrainzMbidType(input.entityType)
    if (!mbidType) return Effect.succeed(null)
    if (input.entityType === 'album') {
      return musicbrainz.lookupByMbid({ mbidType: 'release', mbid, signal: options.signal }).pipe(
        Effect.catchTag('MusicBrainzNotFound', () =>
          musicbrainz.lookupByMbid({
            mbidType: 'release-group',
            mbid,
            signal: options.signal
          })
        ),
        Effect.flatMap((candidate) =>
          enrichMusicBrainzResult(candidate, musicbrainz, options, allowCoverArt)
        )
      )
    }
    return musicbrainz
      .lookupByMbid({ mbidType, mbid, signal: options.signal })
      .pipe(
        Effect.flatMap((candidate) =>
          enrichMusicBrainzResult(candidate, musicbrainz, options, allowCoverArt)
        )
      )
  }

  if (input.entityType === 'track' && input.isrc) {
    return musicbrainz
      .lookupRecordingByIsrc(input.isrc, { signal: options.signal })
      .pipe(
        Effect.flatMap((candidate) =>
          enrichMusicBrainzResult(candidate, musicbrainz, options, allowCoverArt)
        )
      )
  }

  const inferredEntityType = input.entityType ?? sourceDetails(input)?.entityType
  if (input.url && inferredEntityType && inferredEntityType !== 'playlist') {
    return musicbrainz
      .lookupByExternalUrl({
        entityType: inferredEntityType,
        url: input.url,
        signal: options.signal
      })
      .pipe(
        Effect.flatMap((candidate) =>
          enrichMusicBrainzResult(candidate, musicbrainz, options, allowCoverArt)
        )
      )
  }

  return Effect.succeed(null)
}

function urlHostname(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return 'invalid'
  }
}
