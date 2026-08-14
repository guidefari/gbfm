/**
 * Music Link Scraper Service
 *
 * Provider-first design: a `MusicDataProvider` interface defines the contract.
 * Any number of providers can be plugged in; the scraper service orchestrates
 * them and merges results. Later providers override earlier ones for the same
 * platform so the ordering matters.
 *
 * Built-in providers:
 *   OdesliProvider      — free, no API key; converts one streaming URL → 15+
 *                         platform links (Spotify, Apple Music, YouTube Music,
 *                         Tidal, Bandcamp, SoundCloud, etc.)
 *   FirecrawlProvider   — optional (FIRECRAWL_API_KEY); AI-powered page
 *                         scraper for artist pages; good for Discord, social
 *                         links that Odesli doesn't cover
 *   MusicBrainzProvider — optional; canonical open-source music database;
 *                         useful for metadata + finding ISRC codes; currently
 *                         stubs fetchLinks but demonstrates the interface
 *
 * Adding a new provider:
 *   1. Implement MusicDataProvider
 *   2. Add it to the providers array in MusicLinkScraperServiceLayer
 */

import { Context, Data, Effect, Layer, Schedule, Schema } from 'effect'
import { getErrorMessage } from '@/errors'
import { extractBandcampArtist, getBandcampMetadataWithSpan } from '@/services/bandcamp.service'
import { extractSpotifyId, isBandcampUrl } from '@/services/url-utils'
import { SpotifyService } from '@/services/spotify.service'
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
// Provider interface — implement this to add a new data source
// ---------------------------------------------------------------------------

export interface MusicDataProvider {
  /**
   * Unique human-readable name shown in logs and error messages.
   */
  readonly name: string

  /**
   * Fetch platform links for the given input. Return an empty array if this
   * provider doesn't handle the input (e.g. no URL provided for a URL-only
   * provider). Never throw — signal errors via Effect failure.
   */
  readonly fetchLinks: (
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

export class OdesliProvider implements MusicDataProvider {
  readonly name = 'odesli'

  fetchLinks(
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
            odesliEntityId: platformData.entityUniqueId
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
        attributes: { 'scraper.seed_url': seedUrl }
      })
    )
  }
}

// ---------------------------------------------------------------------------
// Firecrawl provider
//   Docs: https://firecrawl.dev — requires FIRECRAWL_API_KEY
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

const MusicBrainzSearchResponseSchema = Schema.Struct({
  recordings: Schema.optional(
    Schema.Array(
      Schema.Struct({
        id: Schema.String,
        title: Schema.String,
        'artist-credit': Schema.optional(Schema.Array(Schema.Struct({ name: Schema.String })))
      })
    )
  )
})

const decodeMusicBrainzSearchResponse = Schema.decodeUnknownSync(MusicBrainzSearchResponseSchema)

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
        yield* Effect.logWarning(`[firecrawl] ${response.status} for ${pageUrl} — skipping`)
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
        attributes: { 'scraper.page_url': pageUrl }
      })
    )
  }
}

// ---------------------------------------------------------------------------
// MusicBrainz provider
//   Docs: https://musicbrainz.org/doc/MusicBrainz_API
//   Rate limit: 1 req/sec without auth; register for higher limits
//   Use case: canonical metadata, ISRCs, label info. Currently provides the
//   MusicBrainz entity URL as a link. Extend fetchLinks to resolve ISRCs
//   through Odesli for richer platform coverage.
// ---------------------------------------------------------------------------

export class MusicBrainzProvider implements MusicDataProvider {
  readonly name = 'musicbrainz'

  fetchLinks(
    input: MusicScrapeInput,
    options: MusicScrapeOptions = {}
  ): Effect.Effect<ProviderResult, MusicScraperError> {
    if (!input.mbid && !input.isrc && !input.artistName) {
      return Effect.succeed({ links: [] })
    }

    return Effect.gen(function* () {
      // If we have a direct MBID, build the canonical MusicBrainz URL
      if (input.mbid) {
        const mbUrl = `https://musicbrainz.org/recording/${input.mbid}`
        return {
          links: [
            {
              platform: 'musicbrainz',
              url: mbUrl,
              scrapedAt: new Date(),
              metadata: { mbid: input.mbid }
            }
          ]
        } satisfies ProviderResult
      }

      // Text-based search via MusicBrainz API
      if (input.artistName || input.trackTitle || input.albumTitle) {
        const query = [
          input.artistName ? `artist:${input.artistName}` : '',
          input.trackTitle ? `recording:${input.trackTitle}` : '',
          input.albumTitle ? `release:${input.albumTitle}` : ''
        ]
          .filter(Boolean)
          .join(' AND ')

        const apiUrl = `https://musicbrainz.org/ws/2/recording/?query=${encodeURIComponent(query)}&fmt=json&limit=1`

        const response = yield* Effect.tryPromise({
          try: (signal) =>
            fetch(apiUrl, {
              headers: { 'User-Agent': 'gbfm/1.0 (https://goosebumps.fm)' },
              signal: options.signal ? AbortSignal.any([signal, options.signal]) : signal
            }),
          catch: (err) =>
            new MusicScraperError({
              message: `MusicBrainz fetch failed: ${getErrorMessage(err)}`,
              provider: 'musicbrainz',
              statusCode: 502
            })
        })

        if (!response.ok) {
          yield* Effect.logWarning(`[musicbrainz] ${response.status} — skipping`)
          return { links: [] } satisfies ProviderResult
        }

        const data = yield* Effect.tryPromise({
          try: () => decodeResponseJson(response, decodeMusicBrainzSearchResponse),
          catch: () =>
            new MusicScraperError({
              message: 'MusicBrainz JSON parse failed',
              provider: 'musicbrainz',
              statusCode: 500
            })
        })

        const recording = data.recordings?.[0]
        if (!recording) return { links: [] } satisfies ProviderResult

        return {
          links: [
            {
              platform: 'musicbrainz',
              url: `https://musicbrainz.org/recording/${recording.id}`,
              scrapedAt: new Date(),
              metadata: { mbid: recording.id }
            }
          ],
          entityMeta: {
            title: recording.title,
            artistName: recording['artist-credit']?.[0]?.name,
            type: 'song'
          }
        } satisfies ProviderResult
      }

      return { links: [] } satisfies ProviderResult
    }).pipe(
      Effect.withSpan('musicScraper.musicbrainz', {
        attributes: { 'scraper.mbid': input.mbid ?? '' }
      })
    )
  }
}

// ---------------------------------------------------------------------------
// Bandcamp provider
//   Scrapes the JSON-LD embedded in a Bandcamp page for title/artist/ISRC.
//   Bandcamp isn't itself a cross-platform link source — Odesli currently
//   fails to resolve most Bandcamp URLs directly (could_not_fetch_entity_data)
//   — so this provider only supplies entityMeta. The scraper orchestrator
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
        attributes: { 'scraper.seed_url': url }
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
   * Never fails — provider errors are logged and swallowed.
   */
  readonly scrape: (
    input: MusicScrapeInput,
    options?: MusicScrapeOptions
  ) => Effect.Effect<ScrapeResult, never>
}

export const MusicLinkScraperService =
  Context.Service<MusicLinkScraperService>('MusicLinkScraperService')

export function makeMusicLinkScraperService(
  providers: MusicDataProvider[],
  spotify: SpotifyService
): MusicLinkScraperService {
  const odesli = new OdesliProvider()

  return {
    scrape: Effect.fn('musicScraper.scrape')(function* (
      input: MusicScrapeInput,
      options: MusicScrapeOptions = {}
    ) {
      const platformMap = new Map<string, ScrapedLink>()
      let entityMeta: EntityMeta | undefined
      let odesliUnavailable = false

      for (const provider of providers) {
        const result = yield* Effect.catch(provider.fetchLinks(input, options), (err) =>
          Effect.andThen(
            Effect.andThen(
              Effect.sync(() => {
                if (provider.name === 'odesli') odesliUnavailable = true
              }),
              Effect.logWarning(`[${provider.name}] scrape failed: ${err.message}`)
            ),
            Effect.succeed({
              links: [],
              entityMeta: undefined
            } satisfies ProviderResult)
          )
        )

        // Later providers override earlier ones for the same platform
        for (const link of result.links) {
          platformMap.set(link.platform, link)
        }

        // Use the first successful entityMeta we get
        if (!entityMeta && result.entityMeta) {
          entityMeta = result.entityMeta
        }
      }

      if (odesliUnavailable && !platformMap.has('spotify') && isSpotifyTrackUrl(input.url)) {
        const spotifyTrack = yield* Effect.catch(
          spotify.getTrack(extractSpotifyId(input.url) ?? ''),
          () => Effect.succeed(null)
        )

        if (spotifyTrack) {
          platformMap.set('spotify', {
            platform: 'spotify',
            url: spotifyTrack.trackUrl,
            scrapedAt: new Date()
          })
          entityMeta ??= {
            title: spotifyTrack.title,
            artistName: spotifyTrack.artists,
            thumbnailUrl: spotifyTrack.albumImageUrl,
            type: 'song'
          }
        }
      }

      // Odesli couldn't resolve the seed URL (e.g. a flaky Bandcamp lookup),
      // but a provider like Bandcamp gave us enough metadata to find the
      // track/album on Spotify ourselves — search for it, then re-run Odesli
      // against the resolved Spotify URL to backfill full platform coverage.
      if (!platformMap.has('spotify') && entityMeta) {
        const spotifyMatch = yield* Effect.catch(
          entityMeta.type === 'album'
            ? spotify.searchAlbumByTitleArtist(entityMeta.title ?? '', entityMeta.artistName ?? '')
            : entityMeta.isrc
              ? spotify.searchTrackByIsrc(entityMeta.isrc)
              : Effect.succeed(null),
          () => Effect.succeed(null)
        )

        if (spotifyMatch) {
          const odesliResult = yield* Effect.catch(
            odesli.fetchLinks({ url: spotifyMatch.url }, options),
            () => Effect.succeed({ links: [], entityMeta: undefined } satisfies ProviderResult)
          )
          for (const link of odesliResult.links) {
            platformMap.set(link.platform, link)
          }
        }
      }

      return {
        links: [...platformMap.values()],
        entityMeta
      } satisfies ScrapeResult
    })
  }
}

// ---------------------------------------------------------------------------
// Live layer — configure which providers are active
// ---------------------------------------------------------------------------

export const MusicLinkScraperServiceLayer = Layer.effect(
  MusicLinkScraperService,
  Effect.gen(function* () {
    const spotify = yield* SpotifyService

    const providers: MusicDataProvider[] = [
      new OdesliProvider(),
      new BandcampProvider(),
      new MusicBrainzProvider()
    ]

    const firecrawlKey = process.env.FIRECRAWL_API_KEY
    if (firecrawlKey) {
      providers.push(new FirecrawlProvider(firecrawlKey))
    }

    return makeMusicLinkScraperService(providers, spotify)
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

function isSpotifyTrackUrl(url: string | undefined): url is string {
  if (!url || !extractSpotifyId(url)) return false

  try {
    const parsed = new URL(url)
    return (
      (parsed.hostname === 'open.spotify.com' ||
        parsed.hostname === 'spotify.com' ||
        parsed.hostname === 'www.spotify.com') &&
      parsed.pathname.startsWith('/track/')
    )
  } catch {
    return false
  }
}
