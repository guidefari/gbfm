import { Effect, Option } from 'effect'
import { getErrorMessage, SpotifyError } from '@/errors'

export interface BandcampAlbum {
  '@type': 'MusicAlbum'
  name: string
  byArtist: { name: string } | { name: string }[]
  image: string
  datePublished: string
  track?: {
    itemListElement: Array<{
      item: {
        name: string
        duration: string
        '@id': string
      }
    }>
  }
  description?: string
}

const bandcampCache = new Map<
  string,
  { data: BandcampAlbum; timestamp: number }
>()
const CACHE_DURATION = 24 * 60 * 60 * 1000 // 24 hours

const parseBandcampHtml = (html: string) =>
  Effect.gen(function* () {
    const metadata: BandcampAlbum = {
      '@type': 'MusicAlbum',
      name: '',
      byArtist: { name: '' },
      image: '',
      datePublished: new Date().toISOString()
    }

    const titleMatch = html.match(
      /<div[^>]*id="name-section"[^>]*>[\s\S]*?<h2[^>]*class="trackTitle"[^>]*>([^<]+)<\/h2>/
    )
    if (titleMatch?.[1]) {
      metadata.name = titleMatch[1].trim()
    } else {
      return yield* new SpotifyError({
        message: 'Could not extract title from Bandcamp page',
        operation: 'parseBandcampHtml',
        statusCode: 500
      })
    }

    const artistMatch = html.match(
      /<div[^>]*id="name-section"[^>]*>[\s\S]*?<h3[^>]*>([\s\S]*?)<\/h3>/
    )
    if (artistMatch?.[1]) {
      const artistText = artistMatch[1].replace(/<[^>]+>/g, '').trim()
      const byMatch = artistText.match(/by\s+(.+)/i)
      if (byMatch?.[1]) {
        metadata.byArtist = { name: byMatch[1].trim() }
      }
    }

    const imageMatch = html.match(
      /<a[^>]*class="popupImage"[^>]*href="([^"]+)"/
    )
    if (imageMatch?.[1]) {
      metadata.image = imageMatch[1]
    }

    const dateMatch = html.match(
      /(?:released|release date)[^>]*(\d{1,2}\s+\w+\s+\d{4}|\w+\s+\d{1,2},?\s+\d{4}|\d{4}-\d{2}-\d{2})/i
    )
    if (dateMatch?.[1]) {
      const parsedDate = new Date(dateMatch[1])
      if (!Number.isNaN(parsedDate.getTime())) {
        metadata.datePublished = parsedDate.toISOString()
      }
    }

    return metadata
  })

export const getBandcampMetadata = (url: string) =>
  Effect.gen(function* () {
    const cacheKey = url
    const cached = bandcampCache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      yield* Effect.annotateCurrentSpan('cache.hit', true)
      return cached.data
    }
    yield* Effect.annotateCurrentSpan('cache.hit', false)

    const response = yield* Effect.tryPromise({
      try: () =>
        fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; MusicMetadataBot/1.0)'
          }
        }),
      catch: (error) =>
        new SpotifyError({
          message: `Failed to fetch Bandcamp page: ${getErrorMessage(error)}`,
          operation: 'getBandcampMetadata',
          statusCode: 500
        })
    })

    yield* Effect.annotateCurrentSpan('http.status_code', response.status)

    if (!response.ok) {
      return yield* new SpotifyError({
        message: `Bandcamp page returned ${response.status}`,
        operation: 'getBandcampMetadata',
        statusCode: response.status
      })
    }

    const html = yield* Effect.tryPromise({
      try: () => response.text(),
      catch: (error) =>
        new SpotifyError({
          message: `Failed to read Bandcamp page content: ${getErrorMessage(error)}`,
          operation: 'getBandcampMetadata',
          statusCode: 500
        })
    })

    let metadata: BandcampAlbum | undefined

    const jsonLdMatch = html.match(
      /<script type="application\/ld\+json">([\s\S]*?)<\/script>/
    )
    if (jsonLdMatch?.[1]) {
      const parseResult = Effect.sync(() => {
        return JSON.parse(jsonLdMatch[1] || '')
      }).pipe(Effect.option)
      const parsed = yield* parseResult
      if (Option.isSome(parsed)) {
        metadata = parsed.value
      }
    }

    if (!metadata) {
      metadata = yield* parseBandcampHtml(html)
    }

    bandcampCache.set(cacheKey, { data: metadata, timestamp: Date.now() })

    return metadata
  })

export const getBandcampMetadataWithSpan = (url: string) =>
  getBandcampMetadata(url).pipe(
    Effect.withSpan('bandcamp.getMetadata', {
      attributes: { 'external.system': 'bandcamp' }
    })
  )

export const parseBandcampDuration = (duration: string): number => {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (match) {
    const hours = parseInt(match[1] || '0', 10)
    const minutes = parseInt(match[2] || '0', 10)
    const seconds = parseInt(match[3] || '0', 10)
    return hours * 3600 + minutes * 60 + seconds
  }
  return 0
}

export const calculateBandcampTotalDuration = (
  metadata: BandcampAlbum
): number | undefined => {
  if (!metadata.track?.itemListElement) return undefined

  return metadata.track.itemListElement.reduce(
    (total, track) =>
      total +
      (track.item.duration ? parseBandcampDuration(track.item.duration) : 0),
    0
  )
}

export const extractBandcampArtist = (metadata: BandcampAlbum): string => {
  return Array.isArray(metadata.byArtist)
    ? metadata.byArtist.map((a) => a.name).join(', ')
    : metadata.byArtist.name
}
