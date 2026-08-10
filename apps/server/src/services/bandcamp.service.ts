import { Effect, Schema } from 'effect'
import { getErrorMessage, SpotifyError } from '@/errors'

export interface BandcampAlbum {
  '@type': 'MusicAlbum' | 'MusicRecording'
  name: string
  byArtist: { readonly name: string } | ReadonlyArray<{ readonly name: string }>
  image: string
  datePublished: string
  isrcCode?: string
  track?: {
    readonly itemListElement: ReadonlyArray<{
      readonly item: {
        readonly name: string
        readonly duration: string
        readonly '@id': string
      }
    }>
  }
  description?: string
}

const BandcampArtistSchema = Schema.Struct({ name: Schema.String })
const BandcampArtistOrArraySchema = Schema.Union([
  BandcampArtistSchema,
  Schema.Array(BandcampArtistSchema)
])

const BandcampTrackListSchema = Schema.Struct({
  itemListElement: Schema.Array(
    Schema.Struct({
      item: Schema.Struct({
        name: Schema.String,
        duration: Schema.String,
        '@id': Schema.String
      })
    })
  )
})

const BandcampJsonLdSchema = Schema.Struct({
  '@type': Schema.String,
  name: Schema.optional(Schema.String),
  image: Schema.optional(Schema.Union([Schema.String, Schema.Array(Schema.String)])),
  datePublished: Schema.optional(Schema.String),
  isrcCode: Schema.optional(Schema.String),
  byArtist: Schema.optional(BandcampArtistOrArraySchema),
  inAlbum: Schema.optional(
    Schema.Struct({
      byArtist: Schema.optional(BandcampArtistOrArraySchema)
    })
  ),
  track: Schema.optional(BandcampTrackListSchema),
  description: Schema.optional(Schema.String)
})

const decodeBandcampJsonLd = Schema.decodeUnknownOption(BandcampJsonLdSchema)

const bandcampCache = new Map<string, { data: BandcampAlbum; timestamp: number }>()
const CACHE_DURATION = 24 * 60 * 60 * 1000 // 24 hours

// A track page's top-level byArtist is the label, not the performer — the
// real artist (when different from the label) lives under inAlbum.byArtist.
const artistForJsonLd = (raw: typeof BandcampJsonLdSchema.Type): BandcampAlbum['byArtist'] =>
  raw.inAlbum?.byArtist ?? raw.byArtist ?? { name: '' }

const parseBandcampJsonLd = (json: string): BandcampAlbum | undefined => {
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    return undefined
  }

  const decoded = decodeBandcampJsonLd(parsed)
  if (decoded._tag === 'None') return undefined
  const raw = decoded.value

  const image = Array.isArray(raw.image) ? raw.image[0] : raw.image
  return {
    '@type': raw['@type'] === 'MusicRecording' ? 'MusicRecording' : 'MusicAlbum',
    name: raw.name ?? '',
    byArtist: artistForJsonLd(raw),
    image: image ?? '',
    datePublished: raw.datePublished ?? new Date().toISOString(),
    isrcCode: raw.isrcCode,
    track: raw.track,
    description: raw.description
  }
}

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

    const imageMatch = html.match(/<a[^>]*class="popupImage"[^>]*href="([^"]+)"/)
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

    const jsonLdMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)
    if (jsonLdMatch?.[1]) {
      metadata = parseBandcampJsonLd(jsonLdMatch[1] || '') || metadata
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

export const calculateBandcampTotalDuration = (metadata: BandcampAlbum): number | undefined => {
  if (!metadata.track?.itemListElement) return undefined

  return metadata.track.itemListElement.reduce(
    (total, track) =>
      total + (track.item.duration ? parseBandcampDuration(track.item.duration) : 0),
    0
  )
}

const isArtistList = (
  value: BandcampAlbum['byArtist']
): value is ReadonlyArray<{ readonly name: string }> => Array.isArray(value)

export const extractBandcampArtist = (metadata: BandcampAlbum): string => {
  const byArtist = metadata.byArtist
  return isArtistList(byArtist) ? byArtist.map((a) => a.name).join(', ') : byArtist.name
}
