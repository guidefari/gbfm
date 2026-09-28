import {
  exchangeSpotifyPkceCodeEffect,
  fetchSpotifyProfileEffect,
  getValidSpotifyAuthSessionEffect,
  logoutSpotifyEffect,
  readAuthorizationCallback,
  SpotifyBrowser,
  SPOTIFY_WEB_SCOPES,
  startSpotifyPkceLoginEffect,
} from '@gbfm/spotify'
import { Context, Data, Effect, Layer, Schema } from 'effect'

const stateKey = 'gbfm:spotify-oauth-state'

const returnKey = 'gbfm:spotify-return-path'

const callbackPath = '/spotify/callback'

export const SpotifyStatus = Schema.Struct({
  connected: Schema.Boolean,
  name: Schema.String,
})

export const disconnected = { connected: false, name: '' }

export class SpotifyConnectionError extends Data.TaggedError('SpotifyConnectionError')<{
  readonly message: string
}> {}

export const safeReturnPath = (path: string | null) => {
  if (!path || !path.startsWith('/') || path.startsWith('//') || path.includes('\\'))
    return '/dashboard/integrations'
  const url = new URL(path, 'https://gbfm.invalid')

  return url.origin === 'https://gbfm.invalid' && url.pathname !== callbackPath
    ? `${url.pathname}${url.search}${url.hash}`
    : '/dashboard/integrations'
}

/** Consume state before exchanging the code; failed and replayed callbacks cannot reuse it. */
export const consumeCallback = (url: URL, storage: Pick<Storage, 'getItem' | 'removeItem'>) => {
  const expected = storage.getItem(stateKey)
  const destination = safeReturnPath(storage.getItem(returnKey))
  storage.removeItem(stateKey)
  storage.removeItem(returnKey)
  const callback = readAuthorizationCallback(url)

  if (callback.error || !callback.code || !callback.state || callback.state !== expected)
    return null

  return { code: callback.code, destination }
}

export class SpotifyConnection extends Context.Service<
  SpotifyConnection,
  {
    readonly status: Effect.Effect<typeof SpotifyStatus.Type, SpotifyConnectionError>
    readonly connect: Effect.Effect<void, SpotifyConnectionError>
    readonly disconnect: Effect.Effect<typeof SpotifyStatus.Type, SpotifyConnectionError>
    readonly completeCallback: Effect.Effect<void, SpotifyConnectionError>
  }
>()('@gbfm/www/SpotifyConnection') {}

const boundary = <A>(operation: () => A) =>
  Effect.try({
    try: operation,
    catch: () =>
      new SpotifyConnectionError({
        message: 'Browser storage is unavailable. Allow site storage and try again.',
      }),
  })

const connectionLayer = Layer.effect(
  SpotifyConnection,
  Effect.gen(function* () {
    const spotify = yield* SpotifyBrowser

    const status = getValidSpotifyAuthSessionEffect().pipe(
      Effect.flatMap((session) =>
        session
          ? fetchSpotifyProfileEffect().pipe(
              Effect.map((profile) => ({
                connected: true,
                name: profile.display_name ?? profile.id,
              })),
            )
          : Effect.succeed(disconnected),
      ),
      Effect.provideService(SpotifyBrowser, spotify),
      Effect.mapError(
        () =>
          new SpotifyConnectionError({
            message: 'Could not read Spotify session. Try connecting again.',
          }),
      ),
    )

    return {
      status,
      connect: Effect.gen(function* () {
        const state = yield* boundary(() => crypto.randomUUID())

        const authorization = yield* startSpotifyPkceLoginEffect(
          SPOTIFY_WEB_SCOPES,
          `${location.origin}${callbackPath}`,
        )

        yield* boundary(() => {
          sessionStorage.setItem(stateKey, state)
          sessionStorage.setItem(returnKey, `${location.pathname}${location.search}`)
          const url = new URL(authorization)
          url.searchParams.set('state', state)
          location.assign(url.href)
        })
      }).pipe(
        Effect.provideService(SpotifyBrowser, spotify),
        Effect.mapError(
          () =>
            new SpotifyConnectionError({
              message: 'Could not start Spotify login. Check browser storage and try again.',
            }),
        ),
      ),
      disconnect: logoutSpotifyEffect().pipe(
        Effect.provideService(SpotifyBrowser, spotify),
        Effect.as(disconnected),
        Effect.mapError(
          () => new SpotifyConnectionError({ message: 'Could not disconnect Spotify.' }),
        ),
      ),
      completeCallback: Effect.gen(function* () {
        const callback = yield* boundary(() => {
          const url = new URL(location.href)
          history.replaceState(history.state, '', callbackPath)

          return consumeCallback(url, sessionStorage)
        })

        const validated = yield* callback
          ? Effect.succeed(callback)
          : Effect.fail(
              new SpotifyConnectionError({
                message:
                  'Spotify authorization is missing, expired, or invalid. Connect again from settings.',
              }),
            )

        yield* exchangeSpotifyPkceCodeEffect(validated.code).pipe(
          Effect.mapError(
            () =>
              new SpotifyConnectionError({
                message: 'Spotify could not complete authorization. Connect again from settings.',
              }),
          ),
        )
        yield* boundary(() => location.replace(validated.destination))
      }).pipe(Effect.provideService(SpotifyBrowser, spotify)),
    }
  }),
)

const browserConnectionLayer = connectionLayer.pipe(
  Layer.provide(
    Layer.suspend(() =>
      SpotifyBrowser.layer({
        clientId: import.meta.env.VITE_SPOTIFY_CLIENT_ID ?? '',
        redirectUri: `${location.origin}${callbackPath}`,
        session: { sessionStorage, localStorage, history },
      }),
    ),
  ),
)

// The optional integration is acquired only for its own operations, never during app hydration.
const withConnection = <A>(
  operation: (connection: SpotifyConnection['Service']) => Effect.Effect<A, SpotifyConnectionError>,
) =>
  SpotifyConnection.pipe(
    Effect.flatMap(operation),
    // oxlint-disable-next-line effecttsgo/strict-effect-provide -- This browser adapter owns the third-party SDK's acquisition boundary.
    Effect.provide(browserConnectionLayer),
    Effect.catchDefect(() =>
      Effect.fail(
        new SpotifyConnectionError({
          message: 'Spotify is unavailable. Check site storage and try again.',
        }),
      ),
    ),
  )

export const SpotifyConnectionLive = Layer.succeed(SpotifyConnection, {
  status: withConnection((connection) => connection.status),
  connect: withConnection((connection) => connection.connect),
  disconnect: withConnection((connection) => connection.disconnect),
  completeCallback: withConnection((connection) => connection.completeCallback),
})
