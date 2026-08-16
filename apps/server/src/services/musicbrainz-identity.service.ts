import { Clock, Context, Effect, Layer, Schema, Semaphore } from 'effect'

const MUSICBRAINZ_API_URL = 'https://musicbrainz.org/ws/2'
const DEFAULT_USER_AGENT = 'gbfm/1.0 (https://github.com/guidefari/gbfm)'
const MBID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const ArtistCreditSchema = Schema.Struct({
  name: Schema.String,
  artist: Schema.optional(Schema.Struct({ id: Schema.String, name: Schema.String }))
})

const ReleaseGroupSummarySchema = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  'primary-type': Schema.optional(Schema.String)
})

const ReleaseSummarySchema = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  country: Schema.optional(Schema.String),
  date: Schema.optional(Schema.String),
  barcode: Schema.optional(Schema.String),
  'release-group': Schema.optional(ReleaseGroupSummarySchema)
})

const ArtistSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  disambiguation: Schema.optional(Schema.String),
  country: Schema.optional(Schema.String)
})

const ReleaseGroupSchema = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  'primary-type': Schema.optional(Schema.String),
  'artist-credit': Schema.optional(Schema.Array(ArtistCreditSchema))
})

const ReleaseSchema = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  country: Schema.optional(Schema.String),
  date: Schema.optional(Schema.String),
  barcode: Schema.optional(Schema.String),
  'artist-credit': Schema.optional(Schema.Array(ArtistCreditSchema)),
  'release-group': ReleaseGroupSummarySchema
})

const RecordingSchema = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  length: Schema.optional(Schema.Number),
  isrcs: Schema.optional(Schema.Array(Schema.String)),
  'artist-credit': Schema.optional(Schema.Array(ArtistCreditSchema)),
  releases: Schema.optional(Schema.Array(ReleaseSummarySchema))
})

const IsrcResponseSchema = Schema.Struct({
  recordings: Schema.optional(Schema.Array(RecordingSchema))
})

const ArtistSearchSchema = Schema.Struct({ artists: Schema.optional(Schema.Array(ArtistSchema)) })
const ReleaseGroupSearchSchema = Schema.Struct({
  'release-groups': Schema.optional(Schema.Array(ReleaseGroupSchema))
})
const RecordingSearchSchema = Schema.Struct({
  recordings: Schema.optional(Schema.Array(RecordingSchema))
})

export type MusicBrainzEntityType = 'artist' | 'album' | 'track'
export type MusicBrainzMbidType = 'artist' | 'release-group' | 'release' | 'recording'
export type MusicBrainzConfidence = 'exact_mbid' | 'exact_isrc' | 'candidate'

export type MusicBrainzProvenance = {
  readonly source: 'musicbrainz'
  readonly confidence: MusicBrainzConfidence
  readonly lookupAt: string
  readonly requestedMbid?: string
  readonly canonicalMbid: string
}

type MusicBrainzCandidateBase = {
  readonly source: 'musicbrainz'
  readonly title: string
  readonly artistNames: readonly string[]
  readonly provenance: MusicBrainzProvenance
}

export type MusicBrainzArtistCandidate = MusicBrainzCandidateBase & {
  readonly entityType: 'artist'
  readonly artistMbid: string
  readonly disambiguation?: string
  readonly country?: string
}

export type MusicBrainzAlbumCandidate = MusicBrainzCandidateBase & {
  readonly entityType: 'album'
  readonly releaseGroup: {
    readonly mbid: string
    readonly primaryType?: string
  }
  readonly editionRelease?: {
    readonly mbid: string
    readonly country?: string
    readonly date?: string
    readonly barcode?: string
  }
}

export type MusicBrainzTrackCandidate = MusicBrainzCandidateBase & {
  readonly entityType: 'track'
  readonly recordingMbid: string
  readonly isrcs: readonly string[]
  readonly durationMs?: number
}

export type MusicBrainzIdentityCandidate =
  | MusicBrainzArtistCandidate
  | MusicBrainzAlbumCandidate
  | MusicBrainzTrackCandidate

export type MusicBrainzLookupInput = {
  readonly mbidType: MusicBrainzMbidType
  readonly mbid: string
  readonly signal?: AbortSignal
}

export type MusicBrainzSearchInput =
  | { readonly entityType: 'artist'; readonly name: string; readonly signal?: AbortSignal }
  | {
      readonly entityType: 'album'
      readonly title: string
      readonly artistName: string
      readonly signal?: AbortSignal
    }
  | {
      readonly entityType: 'track'
      readonly title: string
      readonly artistName: string
      readonly signal?: AbortSignal
    }

export class MusicBrainzInvalidInput extends Schema.TaggedErrorClass<MusicBrainzInvalidInput>()(
  'MusicBrainzInvalidInput',
  { operation: Schema.String, message: Schema.String }
) {}

export class MusicBrainzNotFound extends Schema.TaggedErrorClass<MusicBrainzNotFound>()(
  'MusicBrainzNotFound',
  { operation: Schema.String, identifier: Schema.String }
) {}

export class MusicBrainzRequestFailed extends Schema.TaggedErrorClass<MusicBrainzRequestFailed>()(
  'MusicBrainzRequestFailed',
  {
    operation: Schema.String,
    statusCode: Schema.optional(Schema.Number),
    cause: Schema.Unknown
  }
) {}

export class MusicBrainzResponseInvalid extends Schema.TaggedErrorClass<MusicBrainzResponseInvalid>()(
  'MusicBrainzResponseInvalid',
  { operation: Schema.String, message: Schema.String }
) {}

export type MusicBrainzIdentityError =
  | MusicBrainzInvalidInput
  | MusicBrainzNotFound
  | MusicBrainzRequestFailed
  | MusicBrainzResponseInvalid

export type MusicBrainzFetch = (
  input: string | URL | Request,
  init?: RequestInit
) => Promise<Response>

export interface MusicBrainzIdentityServiceContract {
  readonly lookupByMbid: (
    input: MusicBrainzLookupInput
  ) => Effect.Effect<MusicBrainzIdentityCandidate, MusicBrainzIdentityError>
  readonly lookupRecordingByIsrc: (
    isrc: string,
    options?: { readonly signal?: AbortSignal }
  ) => Effect.Effect<MusicBrainzTrackCandidate, MusicBrainzIdentityError>
  readonly searchCandidates: (
    input: MusicBrainzSearchInput
  ) => Effect.Effect<readonly MusicBrainzIdentityCandidate[], MusicBrainzIdentityError>
}

export class MusicBrainzIdentityService extends Context.Service<
  MusicBrainzIdentityService,
  MusicBrainzIdentityServiceContract
>()('MusicBrainzIdentityService') {}

export type MusicBrainzIdentityOptions = {
  readonly userAgent?: string
  readonly requestIntervalMs?: number
  readonly positiveCacheTtlMs?: number
  readonly negativeCacheTtlMs?: number
  readonly maxRetries?: number
}

type CacheEntry<A> = {
  readonly expiresAt: number
  readonly value: A
}

const artistNames = (credits: readonly (typeof ArtistCreditSchema.Type)[] | undefined) =>
  credits?.map((credit) => credit.name) ?? []

const normalizeIsrc = (isrc: string) => isrc.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()

const provenance = (
  canonicalMbid: string,
  confidence: MusicBrainzConfidence,
  lookupAt: string,
  requestedMbid?: string
): MusicBrainzProvenance => ({
  source: 'musicbrainz',
  confidence,
  lookupAt,
  canonicalMbid,
  requestedMbid: requestedMbid === canonicalMbid ? undefined : requestedMbid
})

const artistCandidate = (
  artist: typeof ArtistSchema.Type,
  confidence: MusicBrainzConfidence,
  lookupAt: string,
  requestedMbid?: string
): MusicBrainzArtistCandidate => ({
  source: 'musicbrainz',
  entityType: 'artist',
  title: artist.name,
  artistNames: [artist.name],
  artistMbid: artist.id,
  disambiguation: artist.disambiguation,
  country: artist.country,
  provenance: provenance(artist.id, confidence, lookupAt, requestedMbid)
})

const albumCandidate = (
  releaseGroup: typeof ReleaseGroupSummarySchema.Type,
  credits: readonly (typeof ArtistCreditSchema.Type)[] | undefined,
  confidence: MusicBrainzConfidence,
  lookupAt: string,
  requestedMbid?: string,
  edition?: typeof ReleaseSummarySchema.Type
): MusicBrainzAlbumCandidate => ({
  source: 'musicbrainz',
  entityType: 'album',
  title: releaseGroup.title,
  artistNames: artistNames(credits),
  releaseGroup: { mbid: releaseGroup.id, primaryType: releaseGroup['primary-type'] },
  editionRelease: edition
    ? {
        mbid: edition.id,
        country: edition.country,
        date: edition.date,
        barcode: edition.barcode
      }
    : undefined,
  provenance: provenance(releaseGroup.id, confidence, lookupAt, requestedMbid)
})

const trackCandidate = (
  recording: typeof RecordingSchema.Type,
  confidence: MusicBrainzConfidence,
  lookupAt: string,
  requestedMbid?: string
): MusicBrainzTrackCandidate => ({
  source: 'musicbrainz',
  entityType: 'track',
  title: recording.title,
  artistNames: artistNames(recording['artist-credit']),
  recordingMbid: recording.id,
  isrcs: recording.isrcs ?? [],
  durationMs: recording.length,
  provenance: provenance(recording.id, confidence, lookupAt, requestedMbid)
})

const canonicalMbidFromResponse = (response: Response, fallback: string) => {
  const segments = URL.parse(response.url)?.pathname.split('/').filter(Boolean) ?? []
  const candidate = segments.at(-1)
  return candidate && MBID_PATTERN.test(candidate) ? candidate : fallback
}

export const makeMusicBrainzIdentityService = Effect.fn('MusicBrainzIdentityService.make')(
  function* (fetcher: MusicBrainzFetch = fetch, options: MusicBrainzIdentityOptions = {}) {
    const semaphore = yield* Semaphore.make(1)
    const mbidCache = new Map<string, CacheEntry<MusicBrainzIdentityCandidate | null>>()
    const isrcCache = new Map<string, CacheEntry<MusicBrainzTrackCandidate | null>>()
    const searchCache = new Map<string, CacheEntry<readonly MusicBrainzIdentityCandidate[]>>()
    const requestIntervalMs = options.requestIntervalMs ?? 1000
    const positiveCacheTtlMs = options.positiveCacheTtlMs ?? 24 * 60 * 60 * 1000
    const negativeCacheTtlMs = options.negativeCacheTtlMs ?? 5 * 60 * 1000
    const maxRetries = options.maxRetries ?? 2
    const userAgent = options.userAgent ?? DEFAULT_USER_AGENT
    let lastRequestAt = Number.NEGATIVE_INFINITY

    const fetchJson = (
      url: string,
      operation: string,
      callerSignal?: AbortSignal
    ): Effect.Effect<
      { readonly payload: unknown; readonly response: Response },
      MusicBrainzIdentityError
    > =>
      semaphore.withPermit(
        Effect.gen(function* () {
          let attempt = 0
          let response: Response | undefined
          while (!response) {
            const now = yield* Clock.currentTimeMillis
            const waitMs = Math.max(0, requestIntervalMs - (now - lastRequestAt))
            if (waitMs > 0) yield* Effect.sleep(`${waitMs} millis`)
            lastRequestAt = yield* Clock.currentTimeMillis

            const current = yield* Effect.tryPromise({
              try: (signal) =>
                fetcher(url, {
                  headers: { Accept: 'application/json', 'User-Agent': userAgent },
                  signal: callerSignal ? AbortSignal.any([signal, callerSignal]) : signal
                }),
              catch: (cause) => new MusicBrainzRequestFailed({ operation, cause })
            })
            if ((current.status === 429 || current.status === 503) && attempt < maxRetries) {
              const retryAfter = current.headers.get('Retry-After')
              const retryAfterSeconds = retryAfter === null ? Number.NaN : Number(retryAfter)
              const backoffMs = Number.isFinite(retryAfterSeconds)
                ? Math.min(5000, Math.max(0, retryAfterSeconds * 1000))
                : Math.min(2000, 250 * 2 ** attempt)
              if (backoffMs > 0) yield* Effect.sleep(`${backoffMs} millis`)
              attempt += 1
            } else {
              response = current
            }
          }

          if (!response.ok) {
            return yield* new MusicBrainzRequestFailed({
              operation,
              statusCode: response.status,
              cause: `MusicBrainz returned HTTP ${response.status}`
            })
          }

          const payload = yield* Effect.tryPromise({
            try: (): Promise<unknown> => response.json(),
            catch: () =>
              new MusicBrainzResponseInvalid({
                operation,
                message: 'MusicBrainz returned invalid JSON'
              })
          })
          return { payload, response }
        })
      )

    const cached = <A, E>(
      cache: Map<string, CacheEntry<A>>,
      key: string,
      effect: Effect.Effect<A, E>,
      isNegative: (value: A) => boolean
    ): Effect.Effect<A, E> =>
      Effect.gen(function* () {
        const now = yield* Clock.currentTimeMillis
        const entry = cache.get(key)
        if (entry && entry.expiresAt > now) return entry.value
        const value = yield* effect
        cache.set(key, {
          value,
          expiresAt: now + (isNegative(value) ? negativeCacheTtlMs : positiveCacheTtlMs)
        })
        return value
      })

    const invalidResponse = (operation: string) =>
      Effect.mapError(
        () =>
          new MusicBrainzResponseInvalid({
            operation,
            message: 'MusicBrainz response did not match the expected shape'
          })
      )

    const lookupByMbid = Effect.fn('MusicBrainzIdentityService.lookupByMbid')(function* (
      input: MusicBrainzLookupInput
    ) {
      if (!MBID_PATTERN.test(input.mbid)) {
        return yield* new MusicBrainzInvalidInput({
          operation: 'lookupByMbid',
          message: 'A valid MusicBrainz identifier is required'
        })
      }
      const key = `mbid:${input.mbidType}:${input.mbid.toLowerCase()}`
      const found = yield* cached(
        mbidCache,
        key,
        Effect.gen(function* () {
          const includes =
            input.mbidType === 'recording'
              ? '&inc=artist-credits+isrcs'
              : input.mbidType === 'release'
                ? '&inc=artist-credits+release-groups'
                : input.mbidType === 'release-group'
                  ? '&inc=artist-credits'
                  : ''
          const result = yield* fetchJson(
            `${MUSICBRAINZ_API_URL}/${input.mbidType}/${input.mbid}?fmt=json${includes}`,
            'lookupByMbid',
            input.signal
          ).pipe(
            Effect.catchTag('MusicBrainzRequestFailed', (error) =>
              error.statusCode === 404 ? Effect.succeed(null) : Effect.fail(error)
            )
          )
          if (!result) return null
          const lookupAt = new Date(yield* Clock.currentTimeMillis).toISOString()
          switch (input.mbidType) {
            case 'artist': {
              const value = yield* Schema.decodeUnknownEffect(ArtistSchema)(result.payload).pipe(
                invalidResponse('lookupByMbid')
              )
              const canonicalId = canonicalMbidFromResponse(result.response, value.id)
              return artistCandidate(
                { ...value, id: canonicalId },
                'exact_mbid',
                lookupAt,
                input.mbid
              )
            }
            case 'release-group': {
              const value = yield* Schema.decodeUnknownEffect(ReleaseGroupSchema)(
                result.payload
              ).pipe(invalidResponse('lookupByMbid'))
              const canonicalId = canonicalMbidFromResponse(result.response, value.id)
              return albumCandidate(
                { ...value, id: canonicalId },
                value['artist-credit'],
                'exact_mbid',
                lookupAt,
                input.mbid
              )
            }
            case 'release': {
              const value = yield* Schema.decodeUnknownEffect(ReleaseSchema)(result.payload).pipe(
                invalidResponse('lookupByMbid')
              )
              return albumCandidate(
                value['release-group'],
                value['artist-credit'],
                'exact_mbid',
                lookupAt,
                input.mbid,
                { ...value, id: canonicalMbidFromResponse(result.response, value.id) }
              )
            }
            case 'recording': {
              const value = yield* Schema.decodeUnknownEffect(RecordingSchema)(result.payload).pipe(
                invalidResponse('lookupByMbid')
              )
              const canonicalId = canonicalMbidFromResponse(result.response, value.id)
              return trackCandidate(
                { ...value, id: canonicalId },
                'exact_mbid',
                lookupAt,
                input.mbid
              )
            }
          }
          return yield* Effect.die('Unsupported MusicBrainz identifier type')
        }),
        (value) => value === null
      )
      if (!found) {
        return yield* new MusicBrainzNotFound({
          operation: 'lookupByMbid',
          identifier: input.mbid
        })
      }
      return found
    })

    const lookupRecordingByIsrc = Effect.fn('MusicBrainzIdentityService.lookupRecordingByIsrc')(
      function* (isrc: string, callOptions: { readonly signal?: AbortSignal } = {}) {
        const normalized = normalizeIsrc(isrc)
        if (!normalized) {
          return yield* new MusicBrainzInvalidInput({
            operation: 'lookupRecordingByIsrc',
            message: 'ISRC is required'
          })
        }
        const found = yield* cached(
          isrcCache,
          `isrc:${normalized}`,
          Effect.gen(function* () {
            const result = yield* fetchJson(
              `${MUSICBRAINZ_API_URL}/isrc/${normalized}?fmt=json&inc=artist-credits+isrcs`,
              'lookupRecordingByIsrc',
              callOptions.signal
            ).pipe(
              Effect.catchTag('MusicBrainzRequestFailed', (error) =>
                error.statusCode === 404 ? Effect.succeed(null) : Effect.fail(error)
              )
            )
            if (!result) return null
            const decoded = yield* Schema.decodeUnknownEffect(IsrcResponseSchema)(
              result.payload
            ).pipe(invalidResponse('lookupRecordingByIsrc'))
            const exact = decoded.recordings?.find((recording) =>
              recording.isrcs?.some((candidate) => normalizeIsrc(candidate) === normalized)
            )
            if (!exact) return null
            const lookupAt = new Date(yield* Clock.currentTimeMillis).toISOString()
            return trackCandidate(exact, 'exact_isrc', lookupAt)
          }),
          (value) => value === null
        )
        if (!found) {
          return yield* new MusicBrainzNotFound({
            operation: 'lookupRecordingByIsrc',
            identifier: normalized
          })
        }
        return found
      }
    )

    const searchCandidates = Effect.fn('MusicBrainzIdentityService.searchCandidates')(function* (
      input: MusicBrainzSearchInput
    ) {
      const hasRequiredMetadata =
        input.entityType === 'artist'
          ? input.name.trim().length > 0
          : input.title.trim().length > 0 && input.artistName.trim().length > 0
      if (!hasRequiredMetadata) {
        return yield* new MusicBrainzInvalidInput({
          operation: 'searchCandidates',
          message: 'Search metadata is required'
        })
      }
      const query =
        input.entityType === 'artist'
          ? `artist:${JSON.stringify(input.name.trim())}`
          : `${input.entityType === 'album' ? 'releasegroup' : 'recording'}:${JSON.stringify(input.title.trim())} AND artist:${JSON.stringify(input.artistName.trim())}`
      const endpoint =
        input.entityType === 'artist'
          ? 'artist'
          : input.entityType === 'album'
            ? 'release-group'
            : 'recording'
      const key = `search:${endpoint}:${query.toLocaleLowerCase('en')}`
      return yield* cached(
        searchCache,
        key,
        Effect.gen(function* () {
          const { payload } = yield* fetchJson(
            `${MUSICBRAINZ_API_URL}/${endpoint}?fmt=json&limit=10&query=${encodeURIComponent(query)}`,
            'searchCandidates',
            input.signal
          )
          const lookupAt = new Date(yield* Clock.currentTimeMillis).toISOString()
          switch (input.entityType) {
            case 'artist': {
              const value = yield* Schema.decodeUnknownEffect(ArtistSearchSchema)(payload).pipe(
                invalidResponse('searchCandidates')
              )
              return (value.artists ?? []).map((artist) =>
                artistCandidate(artist, 'candidate', lookupAt)
              )
            }
            case 'album': {
              const value = yield* Schema.decodeUnknownEffect(ReleaseGroupSearchSchema)(
                payload
              ).pipe(invalidResponse('searchCandidates'))
              return (value['release-groups'] ?? []).map((releaseGroup) =>
                albumCandidate(releaseGroup, releaseGroup['artist-credit'], 'candidate', lookupAt)
              )
            }
            case 'track': {
              const value = yield* Schema.decodeUnknownEffect(RecordingSearchSchema)(payload).pipe(
                invalidResponse('searchCandidates')
              )
              return (value.recordings ?? []).map((recording) =>
                trackCandidate(recording, 'candidate', lookupAt)
              )
            }
          }
          return yield* Effect.die('Unsupported MusicBrainz entity type')
        }),
        (value) => value.length === 0
      )
    })

    return MusicBrainzIdentityService.of({
      lookupByMbid,
      lookupRecordingByIsrc,
      searchCandidates
    })
  }
)

export const MusicBrainzIdentityLive = Layer.effect(
  MusicBrainzIdentityService,
  makeMusicBrainzIdentityService()
)
