import { Schema } from 'effect'
import { HttpApiEndpoint, HttpApiError, HttpApiGroup } from 'effect/unstable/httpapi'

const SpotifyTrackResponse = Schema.Struct({
  albumType: Schema.optional(Schema.String),
  albumImageUrl: Schema.optional(Schema.String),
  title: Schema.String,
  artists: Schema.String,
  trackUrl: Schema.String,
  previewUrl: Schema.optional(Schema.String)
})

const SpotifyAlbumTrack = Schema.Struct({
  title: Schema.String,
  artists: Schema.String,
  previewUrl: Schema.optional(Schema.String),
  trackUrl: Schema.String
})

const SpotifyAlbumResponse = Schema.Struct({
  albumType: Schema.String,
  albumImageUrl: Schema.optional(Schema.String),
  title: Schema.String,
  artists: Schema.String,
  tracks: Schema.Array(SpotifyAlbumTrack),
  albumUrl: Schema.String
})

const SpotifyPlaylistResponse = Schema.Struct({
  coverImageUrl: Schema.optional(Schema.String),
  title: Schema.String,
  description: Schema.optional(Schema.String),
  tracks: Schema.Array(SpotifyAlbumTrack),
  ownerName: Schema.optional(Schema.String),
  playlistUrl: Schema.String
})

const SpotifyAlbumSearchResult = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  artists: Schema.String,
  albumType: Schema.String,
  releaseDate: Schema.String,
  albumImageUrl: Schema.optional(Schema.String),
  albumUrl: Schema.String,
  totalTracks: Schema.Number
})

export const SearchAlbumsResponse = Schema.Struct({
  albums: Schema.Array(SpotifyAlbumSearchResult),
  total: Schema.Number,
  limit: Schema.Number,
  offset: Schema.Number
})

export const SpotifyIdInput = Schema.Struct({
  id: Schema.NonEmptyString
})
export type SpotifyIdInput = typeof SpotifyIdInput.Type

export const SearchAlbumsInput = Schema.Struct({
  query: Schema.NonEmptyString,
  limit: Schema.optional(
    Schema.Number.pipe(Schema.check(Schema.isBetween({ minimum: 1, maximum: 50 })))
  ),
  offset: Schema.optional(Schema.Number.pipe(Schema.check(Schema.isGreaterThanOrEqualTo(0))))
})
export type SearchAlbumsInput = typeof SearchAlbumsInput.Type

const UrlPattern = /^https?:\/\/.+/i
export const EnrichTrackInput = Schema.Struct({
  url: Schema.String.pipe(Schema.check(Schema.isPattern(UrlPattern)))
})
export type EnrichTrackInput = typeof EnrichTrackInput.Type

export const EnrichTrackResponse = Schema.Struct({
  title: Schema.String,
  artist: Schema.String,
  url: Schema.String,
  platform: Schema.Literals(['spotify', 'youtube', 'apple_music', 'bandcamp', 'other']),
  thumbnailUrl: Schema.optional(Schema.String),
  duration: Schema.optional(Schema.Number),
  album: Schema.optional(Schema.String)
})

// The old Hono handler's generic error mapper hard-coded every SpotifyError
// to 502 regardless of the service's own statusCode field (400 for invalid
// input, 500 for real failures) or these routes' documented 404/500
// responses -- a pre-existing bug (see the port's commit message). Fixed
// here to use HttpApiError.BadRequest/InternalServerError based on the
// service's real statusCode, since apps/www's fetcher doesn't branch on
// status code and this has no observable frontend effect.
export const SpotifyGroup = HttpApiGroup.make('spotify')
  .add(
    HttpApiEndpoint.post('getSpotifyTrack', '/api/spotify/track', {
      payload: SpotifyIdInput,
      success: SpotifyTrackResponse,
      error: [HttpApiError.BadRequest, HttpApiError.InternalServerError]
    })
  )
  .add(
    HttpApiEndpoint.post('getSpotifyAlbum', '/api/spotify/album', {
      payload: SpotifyIdInput,
      success: SpotifyAlbumResponse,
      error: [HttpApiError.BadRequest, HttpApiError.InternalServerError]
    })
  )
  .add(
    HttpApiEndpoint.post('getSpotifyPlaylist', '/api/spotify/playlist', {
      payload: SpotifyIdInput,
      success: SpotifyPlaylistResponse,
      error: [HttpApiError.BadRequest, HttpApiError.InternalServerError]
    })
  )
  .add(
    HttpApiEndpoint.post('searchSpotifyAlbums', '/api/spotify/search/albums', {
      payload: SearchAlbumsInput,
      success: SearchAlbumsResponse,
      error: [HttpApiError.BadRequest, HttpApiError.InternalServerError]
    })
  )
  .add(
    HttpApiEndpoint.post('enrichSpotifyTrackFromUrl', '/api/spotify/enrich', {
      payload: EnrichTrackInput,
      success: EnrichTrackResponse,
      error: [HttpApiError.BadRequest, HttpApiError.InternalServerError]
    })
  )
