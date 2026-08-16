import { Context, Effect, Layer, Schema } from 'effect'

const DEEZER_API_URL = 'https://api.deezer.com'
const DEEZER_REQUEST_TIMEOUT = '10 seconds'

const DeezerArtistSchema = Schema.Struct({
  id: Schema.Number,
  name: Schema.String
})

const DeezerAlbumSummarySchema = Schema.Struct({
  id: Schema.Number,
  title: Schema.String,
  cover_xl: Schema.optional(Schema.String)
})

const DeezerTrackSchema = Schema.Struct({
  id: Schema.Number,
  title: Schema.String,
  duration: Schema.Number,
  link: Schema.String,
  isrc: Schema.optional(Schema.String),
  artist: DeezerArtistSchema,
  album: DeezerAlbumSummarySchema
})

const DeezerAlbumSchema = Schema.Struct({
  id: Schema.Number,
  title: Schema.String,
  link: Schema.String,
  cover_xl: Schema.optional(Schema.String),
  release_date: Schema.optional(Schema.String),
  nb_tracks: Schema.optional(Schema.Number),
  artist: DeezerArtistSchema
})

const DeezerPlaylistSchema = Schema.Struct({
  id: Schema.Number,
  title: Schema.String,
  link: Schema.String,
  description: Schema.optional(Schema.String),
  picture_xl: Schema.optional(Schema.String),
  duration: Schema.optional(Schema.Number),
  nb_tracks: Schema.optional(Schema.Number),
  creator: Schema.optional(
    Schema.Struct({
      name: Schema.String
    })
  )
})

const DeezerTrackSearchSchema = Schema.Struct({
  data: Schema.Array(DeezerTrackSchema)
})

const DeezerAlbumSearchSchema = Schema.Struct({
  data: Schema.Array(DeezerAlbumSchema)
})

const decodeTrack = Schema.decodeUnknownEffect(DeezerTrackSchema)
const decodeAlbum = Schema.decodeUnknownEffect(DeezerAlbumSchema)
const decodePlaylist = Schema.decodeUnknownEffect(DeezerPlaylistSchema)
const decodeTrackSearch = Schema.decodeUnknownEffect(DeezerTrackSearchSchema)
const decodeAlbumSearch = Schema.decodeUnknownEffect(DeezerAlbumSearchSchema)

export type DeezerEntityType = 'track' | 'album' | 'playlist'

type DeezerCandidateBase = {
  readonly platform: 'deezer'
  readonly externalId: string
  readonly url: string
  readonly title: string
  readonly artistNames: readonly string[]
  readonly thumbnailUrl?: string
  readonly identifiers: {
    readonly deezerId: string
    readonly isrc?: string
  }
}

export type DeezerTrackCandidate = DeezerCandidateBase & {
  readonly entityType: 'track'
  readonly albumTitle: string
  readonly durationSeconds: number
  readonly match: 'exact_source' | 'exact_isrc'
}

export type DeezerAlbumCandidate = DeezerCandidateBase & {
  readonly entityType: 'album'
  readonly releaseDate?: string
  readonly trackCount?: number
  readonly match: 'exact_source' | 'exact_metadata'
}

export type DeezerPlaylistCandidate = DeezerCandidateBase & {
  readonly entityType: 'playlist'
  readonly description?: string
  readonly durationSeconds?: number
  readonly trackCount?: number
  readonly match: 'exact_source'
  readonly crossPlatformMatching: 'prohibited'
}

export type DeezerSourceCandidate =
  | DeezerTrackCandidate
  | DeezerAlbumCandidate
  | DeezerPlaylistCandidate

export type DeezerResolveInput = {
  readonly entityType: DeezerEntityType
  readonly source: string
  readonly signal?: AbortSignal
}

export type DeezerSearchOptions = {
  readonly signal?: AbortSignal
}

type DeezerOperation = 'resolve' | 'searchTrackByIsrc' | 'searchAlbumByTitleArtist'

export class DeezerInvalidInput extends Schema.TaggedErrorClass<DeezerInvalidInput>()(
  'DeezerInvalidInput',
  {
    operation: Schema.String,
    message: Schema.String
  }
) {}

export class DeezerNotFound extends Schema.TaggedErrorClass<DeezerNotFound>()('DeezerNotFound', {
  entityType: Schema.String,
  externalId: Schema.String
}) {}

export class DeezerRequestFailed extends Schema.TaggedErrorClass<DeezerRequestFailed>()(
  'DeezerRequestFailed',
  {
    operation: Schema.String,
    statusCode: Schema.optional(Schema.Number),
    cause: Schema.Unknown
  }
) {}

export class DeezerResponseInvalid extends Schema.TaggedErrorClass<DeezerResponseInvalid>()(
  'DeezerResponseInvalid',
  {
    operation: Schema.String,
    message: Schema.String
  }
) {}

export class DeezerTimeout extends Schema.TaggedErrorClass<DeezerTimeout>()('DeezerTimeout', {
  operation: Schema.String
}) {}

export class DeezerCancelled extends Schema.TaggedErrorClass<DeezerCancelled>()('DeezerCancelled', {
  operation: Schema.String
}) {}

export type DeezerError =
  | DeezerCancelled
  | DeezerInvalidInput
  | DeezerNotFound
  | DeezerRequestFailed
  | DeezerResponseInvalid
  | DeezerTimeout

export type DeezerFetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

export interface DeezerService {
  readonly resolve: (input: DeezerResolveInput) => Effect.Effect<DeezerSourceCandidate, DeezerError>
  readonly searchTrackByIsrc: (
    isrc: string,
    options?: DeezerSearchOptions
  ) => Effect.Effect<DeezerTrackCandidate | null, DeezerError>
  readonly searchAlbumByTitleArtist: (
    title: string,
    artist: string,
    options?: DeezerSearchOptions
  ) => Effect.Effect<DeezerAlbumCandidate | null, DeezerError>
}

export const DeezerService = Context.Service<DeezerService>('DeezerService')

const parseExternalId = (source: string, expectedType: DeezerEntityType): string | null => {
  if (/^\d+$/.test(source)) return source

  const url = URL.parse(source)
  if (!url || !['deezer.com', 'www.deezer.com'].includes(url.hostname.toLowerCase())) return null

  const segments = url.pathname.split('/').filter(Boolean)
  const typeIndex = segments.findIndex((segment) => segment === expectedType)
  const id = typeIndex === -1 ? undefined : segments[typeIndex + 1]
  return id && /^\d+$/.test(id) ? id : null
}

const canonicalUrl = (entityType: DeezerEntityType, externalId: string) =>
  `https://www.deezer.com/${entityType}/${externalId}`

const normalizeForMatch = (value: string) =>
  value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('en')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

const requestJson = (
  fetcher: DeezerFetch,
  url: string,
  operation: DeezerOperation,
  callerSignal?: AbortSignal
) =>
  Effect.gen(function* () {
    const response = yield* Effect.tryPromise({
      try: (signal) =>
        fetcher(url, {
          headers: { Accept: 'application/json' },
          signal: callerSignal ? AbortSignal.any([signal, callerSignal]) : signal
        }),
      catch: (cause) =>
        callerSignal?.aborted
          ? new DeezerCancelled({ operation })
          : new DeezerRequestFailed({ operation, cause })
    })

    if (!response.ok) {
      return yield* new DeezerRequestFailed({
        operation,
        statusCode: response.status,
        cause: `Deezer returned HTTP ${response.status}`
      })
    }

    return yield* Effect.tryPromise({
      try: (): Promise<unknown> => response.json(),
      catch: () => new DeezerResponseInvalid({ operation, message: 'Deezer returned invalid JSON' })
    })
  }).pipe(
    Effect.timeout(DEEZER_REQUEST_TIMEOUT),
    Effect.catchTag('TimeoutError', () => Effect.fail(new DeezerTimeout({ operation })))
  )

const invalidResponse = (operation: DeezerOperation) =>
  Effect.mapError(
    () =>
      new DeezerResponseInvalid({
        operation,
        message: 'Deezer response did not match the expected shape'
      })
  )

const trackCandidate = (
  track: typeof DeezerTrackSchema.Type,
  match: DeezerTrackCandidate['match']
): DeezerTrackCandidate => ({
  platform: 'deezer',
  entityType: 'track',
  externalId: String(track.id),
  url: canonicalUrl('track', String(track.id)),
  title: track.title,
  artistNames: [track.artist.name],
  thumbnailUrl: track.album.cover_xl,
  albumTitle: track.album.title,
  durationSeconds: track.duration,
  identifiers: { deezerId: String(track.id), isrc: track.isrc },
  match
})

const albumCandidate = (
  album: typeof DeezerAlbumSchema.Type,
  match: DeezerAlbumCandidate['match']
): DeezerAlbumCandidate => ({
  platform: 'deezer',
  entityType: 'album',
  externalId: String(album.id),
  url: canonicalUrl('album', String(album.id)),
  title: album.title,
  artistNames: [album.artist.name],
  thumbnailUrl: album.cover_xl,
  releaseDate: album.release_date,
  trackCount: album.nb_tracks,
  identifiers: { deezerId: String(album.id) },
  match
})

const playlistCandidate = (
  playlist: typeof DeezerPlaylistSchema.Type
): DeezerPlaylistCandidate => ({
  platform: 'deezer',
  entityType: 'playlist',
  externalId: String(playlist.id),
  url: canonicalUrl('playlist', String(playlist.id)),
  title: playlist.title,
  artistNames: playlist.creator ? [playlist.creator.name] : [],
  thumbnailUrl: playlist.picture_xl,
  description: playlist.description,
  durationSeconds: playlist.duration,
  trackCount: playlist.nb_tracks,
  identifiers: { deezerId: String(playlist.id) },
  match: 'exact_source',
  crossPlatformMatching: 'prohibited'
})

export const makeDeezerService = (fetcher: DeezerFetch = fetch): DeezerService => {
  const resolve = Effect.fn('deezer.resolve')(function* (input: DeezerResolveInput) {
    const externalId = parseExternalId(input.source, input.entityType)
    if (!externalId) {
      return yield* new DeezerInvalidInput({
        operation: 'resolve',
        message: `Invalid Deezer ${input.entityType} URL or ID`
      })
    }

    const payload = yield* requestJson(
      fetcher,
      `${DEEZER_API_URL}/${input.entityType}/${externalId}`,
      'resolve',
      input.signal
    ).pipe(
      Effect.mapError((error) =>
        error._tag === 'DeezerRequestFailed' && error.statusCode === 404
          ? new DeezerNotFound({ entityType: input.entityType, externalId })
          : error
      )
    )

    switch (input.entityType) {
      case 'track':
        return trackCandidate(
          yield* decodeTrack(payload).pipe(invalidResponse('resolve')),
          'exact_source'
        )
      case 'album':
        return albumCandidate(
          yield* decodeAlbum(payload).pipe(invalidResponse('resolve')),
          'exact_source'
        )
      case 'playlist':
        return playlistCandidate(yield* decodePlaylist(payload).pipe(invalidResponse('resolve')))
    }

    return yield* Effect.die('Unsupported Deezer entity type')
  })

  const searchTrackByIsrc = Effect.fn('deezer.searchTrackByIsrc')(function* (
    isrc: string,
    options: DeezerSearchOptions = {}
  ) {
    const normalizedIsrc = isrc.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
    if (!normalizedIsrc) {
      return yield* new DeezerInvalidInput({
        operation: 'searchTrackByIsrc',
        message: 'ISRC is required'
      })
    }

    const payload = yield* requestJson(
      fetcher,
      `${DEEZER_API_URL}/search/track?q=${encodeURIComponent(`isrc:"${normalizedIsrc}"`)}`,
      'searchTrackByIsrc',
      options.signal
    )
    const result = yield* decodeTrackSearch(payload).pipe(invalidResponse('searchTrackByIsrc'))
    const exact = result.data.find(
      (track) => track.isrc?.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() === normalizedIsrc
    )
    return exact ? trackCandidate(exact, 'exact_isrc') : null
  })

  const searchAlbumByTitleArtist = Effect.fn('deezer.searchAlbumByTitleArtist')(function* (
    title: string,
    artist: string,
    options: DeezerSearchOptions = {}
  ) {
    const normalizedTitle = normalizeForMatch(title)
    const normalizedArtist = normalizeForMatch(artist)
    if (!normalizedTitle || !normalizedArtist) {
      return yield* new DeezerInvalidInput({
        operation: 'searchAlbumByTitleArtist',
        message: 'Album title and artist are required'
      })
    }

    const query = `album:"${title.trim()}" artist:"${artist.trim()}"`
    const payload = yield* requestJson(
      fetcher,
      `${DEEZER_API_URL}/search/album?q=${encodeURIComponent(query)}`,
      'searchAlbumByTitleArtist',
      options.signal
    )
    const result = yield* decodeAlbumSearch(payload).pipe(
      invalidResponse('searchAlbumByTitleArtist')
    )
    const exact = result.data.find(
      (album) =>
        normalizeForMatch(album.title) === normalizedTitle &&
        normalizeForMatch(album.artist.name) === normalizedArtist
    )
    return exact ? albumCandidate(exact, 'exact_metadata') : null
  })

  return { resolve, searchTrackByIsrc, searchAlbumByTitleArtist }
}

export const DeezerServiceLayer = Layer.succeed(DeezerService, makeDeezerService())
