import { Api } from '@gbfm/api/api'
import { Data, Effect, Match, Predicate, type Redacted } from 'effect'
import { HttpClient, HttpClientRequest } from 'effect/http'
import { HttpApiClient } from 'effect/http-api'

export type FavoriteTrack = {
  readonly id: string
  readonly type: 'mix' | 'track' | 'misc'
  readonly slug: string
}

export type FavoritesConnection = {
  readonly httpClient: HttpClient.HttpClient
  readonly baseUrl: string
  readonly sessionToken: Redacted.Redacted
}

export class FavoriteSessionExpired extends Data.TaggedError('FavoriteSessionExpired') {}

export class FavoriteTrackUnavailable extends Data.TaggedError('FavoriteTrackUnavailable') {}

export class FavoriteRequestFailed extends Data.TaggedError('FavoriteRequestFailed') {}

export type FavoriteError =
  | FavoriteSessionExpired
  | FavoriteTrackUnavailable
  | FavoriteRequestFailed

const authorizedClient = (connection: FavoritesConnection) =>
  HttpClient.mapRequest(
    connection.httpClient,
    HttpClientRequest.bearerToken(connection.sessionToken),
  )

const failRequest = () => Effect.fail(new FavoriteRequestFailed())

const toFavoriteError = (error: { readonly _tag: string }): FavoriteError => {
  if (Predicate.isTagged(error, 'NotFound')) return new FavoriteTrackUnavailable()

  if (Predicate.isTagged(error, 'Unauthorized')) return new FavoriteSessionExpired()

  return new FavoriteRequestFailed()
}

const pageFavorite = {
  active: () => Effect.succeed(true),
  inactive: () => Effect.succeed(false),
  anonymous: () => Effect.fail(new FavoriteSessionExpired()),
  unavailable: () => Effect.fail(new FavoriteRequestFailed()),
}

export const loadFavorite = (connection: FavoritesConnection, track: FavoriteTrack) =>
  Effect.gen(function* () {
    const audio = yield* HttpApiClient.group(Api, {
      group: 'audio',
      httpClient: authorizedClient(connection),
      baseUrl: connection.baseUrl,
    })

    const page = yield* audio
      .getAudioPage({ params: { type: track.type, slug: track.slug } })
      .pipe(Effect.catch(failRequest))

    return yield* Match.value(page).pipe(
      Match.tagsExhaustive({
        NotFound: () => Effect.fail(new FavoriteTrackUnavailable()),
        Unavailable: () => Effect.fail(new FavoriteRequestFailed()),
        Ready: (ready) =>
          ready.audio.id === track.id
            ? pageFavorite[ready.favorite]()
            : Effect.fail(new FavoriteTrackUnavailable()),
      }),
    )
  })

export const saveFavorite = (
  connection: FavoritesConnection,
  track: FavoriteTrack,
  favorite: boolean,
) =>
  Effect.gen(function* () {
    const favorites = yield* HttpApiClient.group(Api, {
      group: 'favorites',
      httpClient: authorizedClient(connection),
      baseUrl: connection.baseUrl,
    })

    if (favorite) {
      return yield* favorites.addFavorite({ payload: { audioId: track.id } }).pipe(
        Effect.as(true),
        Effect.catchTag('Conflict', () => Effect.succeed(true)),
        Effect.mapError(toFavoriteError),
      )
    }

    return yield* favorites.removeFavorite({ params: { audioId: track.id } }).pipe(
      Effect.as(false),
      Effect.catchTag('NotFound', () => Effect.succeed(false)),
      Effect.mapError(toFavoriteError),
    )
  })
