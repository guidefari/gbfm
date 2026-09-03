import type { MusicEntityMetadata } from '@/db/music-entity.schema'
import type { ScrapeResult, ScrapedLink } from '@/services/music-link-scraper.service'
import { Effect } from 'effect'
import type { CanonicalMusicEntityType, ParsedMusicSource } from './music-source'
import { parseMusicSource } from './music-source'

export type ProviderMusicLink = {
  readonly platform: ScrapedLink['platform']
  readonly url: string
  readonly scrapedAt?: Date
  readonly metadata?: MusicEntityMetadata
}

export type ProviderMusicSnapshot = {
  readonly entityType: CanonicalMusicEntityType
  readonly sourceUrl: string
  readonly title: string
  readonly artistNames?: readonly string[]
  readonly imageUrl?: string
  readonly description?: string
  readonly trackNumber?: number
  readonly curatorId?: string | null
  readonly sourceMetadata?: MusicEntityMetadata
  readonly links?: readonly ProviderMusicLink[]
}

export const inferredType = (
  source: ParsedMusicSource,
  result: ScrapeResult
): CanonicalMusicEntityType | undefined => {
  const type = source.sourceEntityType
  if (type === 'artist' || type === 'album' || type === 'track' || type === 'playlist') return type
  if (result.entityMeta?.type === 'song') return 'track'
  return result.entityMeta?.type
}

export const hasUsableResult = (result: ScrapeResult) =>
  result.links.length > 0 ||
  Boolean(
    result.entityMeta?.title ||
    result.entityMeta?.artistName ||
    result.entityMeta?.thumbnailUrl ||
    result.entityMeta?.isrc
  )

export const snapshotResult = (
  snapshot: ProviderMusicSnapshot,
  source: ParsedMusicSource
): ScrapeResult => ({
  entityMeta: {
    title: snapshot.title,
    artistName: snapshot.artistNames?.join(', '),
    thumbnailUrl: snapshot.imageUrl,
    type: snapshot.entityType === 'track' ? 'song' : snapshot.entityType
  },
  links: [
    ...(snapshot.links ?? []).map((link) => ({
      platform: link.platform,
      url: link.url,
      scrapedAt: link.scrapedAt ?? new Date(),
      metadata: link.metadata
    })),
    {
      platform: source.platform,
      url: source.canonicalUrl,
      scrapedAt: new Date(),
      metadata: {
        ...snapshot.sourceMetadata,
        discoveredBy: source.platform,
        confidence: 'exact_source'
      }
    }
  ]
})

export const uniqueLinks = (source: ParsedMusicSource, result: ScrapeResult, scrapedAt: Date) => {
  const links = new Map<ScrapedLink['platform'], ScrapedLink>()
  for (const link of result.links) {
    if (link.platform !== source.platform) links.set(link.platform, link)
  }
  const providerLink = result.links.find((link) => link.platform === source.platform)
  links.set(source.platform, {
    platform: source.platform,
    url: source.canonicalUrl,
    scrapedAt: providerLink?.scrapedAt ?? scrapedAt,
    metadata: {
      ...providerLink?.metadata,
      discoveredBy: providerLink?.metadata?.discoveredBy ?? source.platform,
      confidence: 'exact_source'
    }
  })
  return [...links.values()]
}

export const parseDiscoveredSources = (
  initial: ParsedMusicSource,
  links: readonly ScrapedLink[],
  entityType: CanonicalMusicEntityType
) =>
  Effect.gen(function* () {
    const sources = new Map<string, ParsedMusicSource>([[initial.sourceKey, initial]])
    for (const link of links) {
      const parsed = yield* parseMusicSource(link.url, entityType).pipe(
        Effect.catchTag('MusicSourceInvalid', () => Effect.succeed(undefined))
      )
      if (parsed) sources.set(parsed.sourceKey, parsed)
    }
    return [...sources.values()].sort((left, right) =>
      left.sourceKey.localeCompare(right.sourceKey)
    )
  })
