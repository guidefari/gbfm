/**
 * Music Link Scraper Service
 *
 * Finds platform links for a given music entity.
 *
 * Primary:   Odesli / song.link  — free, no auth, converts one streaming URL
 *            to 15+ platform links (Spotify, Apple Music, YouTube Music,
 *            Tidal, Deezer, Amazon Music, Bandcamp, Soundcloud, etc.)
 *
 * Secondary: Firecrawl AI — paid scraper that turns any web page into
 *            structured data. Useful for scraping artist pages for social
 *            links (Bandcamp, Discord, Instagram, etc.) that Odesli doesn't
 *            cover. Requires FIRECRAWL_API_KEY env var.
 *
 * Usage:
 *   const scraper = new MusicLinkScraperService()
 *   const links = await scraper.scrapeFromUrl('https://open.spotify.com/album/...')
 */

import { Context, Data, Effect, Layer } from 'effect'
import { getErrorMessage } from '@/errors'
import type { MusicPlatform } from '../db/music-entity.schema'

// ---------------------------------------------------------------------------
// Error type
// ---------------------------------------------------------------------------

export class MusicScraperError extends Data.TaggedError('MusicScraperError')<{
  readonly message: string
  readonly operation: string
  readonly statusCode?: number
}> {}

// ---------------------------------------------------------------------------
// Odesli (song.link) types
// ---------------------------------------------------------------------------

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
  thumbnailWidth?: number
  thumbnailHeight?: number
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

// ---------------------------------------------------------------------------
// Scraped link result
// ---------------------------------------------------------------------------

export interface ScrapedLink {
  platform: MusicPlatform
  url: string
  scrapedAt: Date
  metadata?: Record<string, unknown>
}

export interface ScrapeResult {
  links: ScrapedLink[]
  /** Canonical metadata extracted from the seed URL */
  entityMeta?: {
    title?: string
    artistName?: string
    thumbnailUrl?: string
    type?: 'song' | 'album'
  }
}

// ---------------------------------------------------------------------------
// Platform name mapping: Odesli key → our MusicPlatform
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

// ---------------------------------------------------------------------------
// Odesli scraper
// ---------------------------------------------------------------------------

const scrapeViaOdesli = (seedUrl: string) =>
  Effect.gen(function* () {
    const encoded = encodeURIComponent(seedUrl)
    const apiUrl = `https://api.song.link/v1-alpha.1/links?url=${encoded}&userCountry=US`

    const response = yield* Effect.tryPromise({
      try: () => fetch(apiUrl),
      catch: (error) =>
        new MusicScraperError({
          message: `Odesli fetch failed: ${getErrorMessage(error)}`,
          operation: 'scrapeViaOdesli',
          statusCode: 502
        })
    })

    if (!response.ok) {
      // 404 means Odesli couldn't find the entity — not a fatal error
      if (response.status === 404) {
        return yield* Effect.succeed<ScrapeResult>({ links: [] })
      }
      return yield* new MusicScraperError({
        message: `Odesli returned ${response.status}`,
        operation: 'scrapeViaOdesli',
        statusCode: response.status
      })
    }

    const data: OdesliResponse = yield* Effect.tryPromise({
      try: () => response.json() as Promise<OdesliResponse>,
      catch: (error) =>
        new MusicScraperError({
          message: `Odesli JSON parse failed: ${getErrorMessage(error)}`,
          operation: 'scrapeViaOdesli',
          statusCode: 500
        })
    })

    const scrapedAt = new Date()

    const links: ScrapedLink[] = Object.entries(data.linksByPlatform).flatMap(
      ([odesliKey, platformData]) => {
        const platform = ODESLI_PLATFORM_MAP[odesliKey]
        if (!platform) return []
        const link: ScrapedLink = {
          platform,
          url: platformData.url,
          scrapedAt,
          metadata: {
            odesliEntityId: platformData.entityUniqueId,
            nativeAppUriMobile: platformData.nativeAppUriMobile,
            nativeAppUriDesktop: platformData.nativeAppUriDesktop
          }
        }
        return [link]
      }
    )

    // Extract canonical metadata from the primary entity
    const primaryEntity =
      data.entitiesByUniqueId[data.entityUniqueId] ??
      Object.values(data.entitiesByUniqueId)[0]

    const entityMeta: ScrapeResult['entityMeta'] = primaryEntity
      ? {
          title: primaryEntity.title,
          artistName: primaryEntity.artistName,
          thumbnailUrl: primaryEntity.thumbnailUrl,
          type: primaryEntity.type
        }
      : undefined

    return { links, entityMeta } satisfies ScrapeResult
  }).pipe(
    Effect.withSpan('musicScraper.odesli', {
      attributes: { 'scraper.seed_url': seedUrl }
    })
  )

// ---------------------------------------------------------------------------
// Firecrawl scraper (optional, requires FIRECRAWL_API_KEY)
// Use this for artist pages to extract social/Discord/Bandcamp links that
// Odesli doesn't know about.
// ---------------------------------------------------------------------------

interface FirecrawlExtractResult {
  links?: Array<{ url: string; text: string }>
  socialLinks?: Partial<Record<MusicPlatform, string>>
}

/**
 * Scrapes an artist page via Firecrawl to extract social/platform links.
 * Returns an empty result if FIRECRAWL_API_KEY is not configured.
 */
const scrapeArtistPageViaFirecrawl = (
  pageUrl: string,
  apiKey: string
): Effect.Effect<ScrapedLink[], MusicScraperError> =>
  Effect.gen(function* () {
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
                  description: 'Streaming and social links keyed by platform name',
                  additionalProperties: { type: 'string' }
                }
              }
            }
          })
        }),
      catch: (error) =>
        new MusicScraperError({
          message: `Firecrawl fetch failed: ${getErrorMessage(error)}`,
          operation: 'scrapeArtistPageViaFirecrawl',
          statusCode: 502
        })
    })

    if (!response.ok) {
      // Non-fatal — log and return empty
      yield* Effect.logWarning(
        `Firecrawl returned ${response.status} for ${pageUrl}`
      )
      return []
    }

    const data: FirecrawlExtractResult = yield* Effect.tryPromise({
      try: () => response.json() as Promise<FirecrawlExtractResult>,
      catch: () =>
        new MusicScraperError({
          message: 'Firecrawl JSON parse failed',
          operation: 'scrapeArtistPageViaFirecrawl',
          statusCode: 500
        })
    })

    const scrapedAt = new Date()
    const links: ScrapedLink[] = []

    if (data.socialLinks) {
      for (const [key, url] of Object.entries(data.socialLinks)) {
        if (!url) continue
        // Map common names to our platform enum
        const platform = mapFirecrawlPlatform(key)
        links.push({ platform, url, scrapedAt })
      }
    }

    return links
  }).pipe(
    Effect.withSpan('musicScraper.firecrawl', {
      attributes: { 'scraper.page_url': pageUrl }
    })
  )

function mapFirecrawlPlatform(key: string): MusicPlatform {
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
  return 'other'
}

// ---------------------------------------------------------------------------
// Service interface
// ---------------------------------------------------------------------------

export interface MusicLinkScraperService {
  /**
   * Given any music streaming URL, fetch all known platform links via Odesli.
   * Works for Spotify, Apple Music, YouTube Music, Tidal, Bandcamp, etc.
   */
  readonly scrapeFromUrl: (
    seedUrl: string
  ) => Effect.Effect<ScrapeResult, MusicScraperError>

  /**
   * Scrape an artist/label page for social and platform links using Firecrawl.
   * Requires FIRECRAWL_API_KEY to be configured.
   */
  readonly scrapeArtistPage: (
    pageUrl: string
  ) => Effect.Effect<ScrapedLink[], MusicScraperError>
}

export const MusicLinkScraperService =
  Context.GenericTag<MusicLinkScraperService>('MusicLinkScraperService')

// ---------------------------------------------------------------------------
// Live implementation
// ---------------------------------------------------------------------------

export const MusicLinkScraperServiceLive = Layer.succeed(
  MusicLinkScraperService,
  {
    scrapeFromUrl: (seedUrl: string) =>
      scrapeViaOdesli(seedUrl).pipe(
        Effect.withSpan('musicScraper.scrapeFromUrl', {
          attributes: { 'scraper.seed_url': seedUrl }
        })
      ),

    scrapeArtistPage: (pageUrl: string) => {
      const firecrawlKey = process.env.FIRECRAWL_API_KEY
      if (!firecrawlKey) {
        return Effect.logWarning(
          'FIRECRAWL_API_KEY not set — skipping Firecrawl scrape'
        ).pipe(Effect.as([]))
      }
      return scrapeArtistPageViaFirecrawl(pageUrl, firecrawlKey)
    }
  }
)
