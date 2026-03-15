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
 *   2. Add it to the providers array in MusicLinkScraperServiceLive
 */

import { Context, Data, Effect, Layer } from 'effect'
import { getErrorMessage } from '@/errors'
import type { MusicPlatform } from '../db/music-entity.schema'

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

export interface ScrapedLink {
  platform: MusicPlatform
  url: string
  scrapedAt: Date
  metadata?: Record<string, unknown>
}

export interface EntityMeta {
  title?: string
  artistName?: string
  thumbnailUrl?: string
  type?: 'song' | 'album' | 'artist' | 'playlist'
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
    input: MusicScrapeInput
  ) => Effect.Effect<ProviderResult, MusicScraperError>
}

// ---------------------------------------------------------------------------
// Odesli / song.link provider
//   Docs: https://odesli.co (no auth required for reasonable usage)
// ---------------------------------------------------------------------------

const ODESLI_PLATFORM_MAP: Record<string, MusicPlatform> = {
  spotify: 'spotify',
  youtube: 'youtube',
  youtubeMusic: 'youtube_music',
  appleMusic: 'apple_music',
  tidal: 'tidal',
  deezer: 'deezer',
  amazonMusic: 'amazon_music',
  napster: 'other',
  pandora: 'other',
  soundcloud: 'soundcloud',
  bandcamp: 'bandcamp'
}

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
  platforms: string[]
}

interface OdesliResponse {
  entityUniqueId: string
  userCountry: string
  pageUrl: string
  linksByPlatform: Record<string, OdesliPlatformLink>
  entitiesByUniqueId: Record<string, OdesliEntity>
}

export class OdesliProvider implements MusicDataProvider {
  readonly name = 'odesli'

  fetchLinks(
    input: MusicScrapeInput
  ): Effect.Effect<ProviderResult, MusicScraperError> {
    if (!input.url) return Effect.succeed({ links: [] })

    const seedUrl = input.url
    return Effect.gen(function* () {
      const encoded = encodeURIComponent(seedUrl)
      const apiUrl = `https://api.song.link/v1-alpha.1/links?url=${encoded}&userCountry=US`

      const response = yield* Effect.tryPromise({
        try: () => fetch(apiUrl),
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
        try: () => response.json() as Promise<OdesliResponse>,
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
          const platform = ODESLI_PLATFORM_MAP[key]
          if (!platform) return []
          return [
            {
              platform,
              url: platformData.url,
              scrapedAt,
              metadata: {
                odesliEntityId: platformData.entityUniqueId,
                nativeAppUriMobile: platformData.nativeAppUriMobile,
                nativeAppUriDesktop: platformData.nativeAppUriDesktop
              }
            } satisfies ScrapedLink
          ]
        }
      )

      const primaryEntity =
        data.entitiesByUniqueId[data.entityUniqueId] ??
        Object.values(data.entitiesByUniqueId)[0]

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

export class FirecrawlProvider implements MusicDataProvider {
  readonly name = 'firecrawl'

  constructor(private readonly apiKey: string) {}

  fetchLinks(
    input: MusicScrapeInput
  ): Effect.Effect<ProviderResult, MusicScraperError> {
    if (!input.url) return Effect.succeed({ links: [] })

    const pageUrl = input.url
    const apiKey = this.apiKey

    return Effect.gen(function* () {
      const response = yield* Effect.tryPromise({
        try: () =>
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
                    description:
                      'Streaming and social links keyed by platform name',
                    additionalProperties: { type: 'string' }
                  }
                }
              }
            })
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
          `[firecrawl] ${response.status} for ${pageUrl} — skipping`
        )
        return { links: [] } satisfies ProviderResult
      }

      const data: FirecrawlExtractResult = yield* Effect.tryPromise({
        try: () => response.json() as Promise<FirecrawlExtractResult>,
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
    input: MusicScrapeInput
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
              platform: 'musicbrainz' as MusicPlatform,
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
          try: () =>
            fetch(apiUrl, {
              headers: { 'User-Agent': 'gbfm/1.0 (https://gbfm.co.za)' }
            }),
          catch: (err) =>
            new MusicScraperError({
              message: `MusicBrainz fetch failed: ${getErrorMessage(err)}`,
              provider: 'musicbrainz',
              statusCode: 502
            })
        })

        if (!response.ok) {
          yield* Effect.logWarning(
            `[musicbrainz] ${response.status} — skipping`
          )
          return { links: [] } satisfies ProviderResult
        }

        const data = yield* Effect.tryPromise({
          try: () =>
            response.json() as Promise<{
              recordings?: Array<{
                id: string
                title: string
                'artist-credit'?: Array<{ name: string }>
              }>
            }>,
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
              platform: 'musicbrainz' as MusicPlatform,
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
// Service interface & implementation
// ---------------------------------------------------------------------------

export interface MusicLinkScraperService {
  /**
   * Run all configured providers against the input. Results are merged;
   * if two providers return a link for the same platform, the later one wins.
   * Never fails — provider errors are logged and swallowed.
   */
  readonly scrape: (
    input: MusicScrapeInput
  ) => Effect.Effect<ScrapeResult, never>
}

export const MusicLinkScraperService =
  Context.GenericTag<MusicLinkScraperService>('MusicLinkScraperService')

function makeScraperWithProviders(
  providers: MusicDataProvider[]
): MusicLinkScraperService {
  return {
    scrape: Effect.fn('musicScraper.scrape')(function* (
      input: MusicScrapeInput
    ) {
      const platformMap = new Map<string, ScrapedLink>()
      let entityMeta: EntityMeta | undefined

      for (const provider of providers) {
        const result = yield* Effect.catchAll(
          provider.fetchLinks(input),
          (err) =>
            Effect.zipRight(
              Effect.logWarning(
                `[${provider.name}] scrape failed: ${err.message}`
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

export const MusicLinkScraperServiceLive = Layer.sync(
  MusicLinkScraperService,
  () => {
    const providers: MusicDataProvider[] = [
      new OdesliProvider(),
      new MusicBrainzProvider()
    ]

    const firecrawlKey = process.env.FIRECRAWL_API_KEY
    if (firecrawlKey) {
      providers.push(new FirecrawlProvider(firecrawlKey))
    }

    return makeScraperWithProviders(providers)
  }
)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mapToPlatform(key: string): MusicPlatform {
  const lower = key.toLowerCase()
  if (lower.includes('spotify')) return 'spotify'
  if (lower.includes('youtube_music') || lower === 'youtubemusic')
    return 'youtube_music'
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
