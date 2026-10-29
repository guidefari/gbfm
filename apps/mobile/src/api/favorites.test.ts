import { AudioPageResponse } from '@gbfm/api/audio'
import { Effect, Redacted, Schema } from 'effect'
import { HttpClient, HttpClientError, HttpClientResponse } from 'effect/http'
import { describe, expect, test } from 'vitest'

import { getSessionWithClient } from './auth'
import { loadFavorite, saveFavorite, type FavoriteTrack } from './favorites'

const track: FavoriteTrack = {
  id: '6f1c2a54-3b0e-4d7a-9a51-2f0c8d4e7b19',
  type: 'mix',
  slug: 'late-night-signal',
}

type SeenRequest = {
  readonly method: string
  readonly path: string
  readonly authorization: string
}

const fakeServer = (respond: (method: string, path: string) => Response | undefined) => {
  const seen: Array<SeenRequest> = []

  const httpClient = HttpClient.make((request, url) =>
    Effect.gen(function* () {
      seen.push({
        method: request.method,
        path: url.pathname,
        authorization: request.headers['authorization'] ?? '',
      })

      const response = respond(request.method, url.pathname)

      if (!response) {
        return yield* new HttpClientError.HttpClientError({
          reason: new HttpClientError.TransportError({ request }),
        })
      }

      return HttpClientResponse.fromWeb(request, response)
    }),
  )

  return {
    seen,
    connection: {
      httpClient,
      baseUrl: 'http://fixture.test',
      sessionToken: Redacted.make('fixture-session-token'),
    },
  }
}

type ReadyPage = Extract<AudioPageResponse, { readonly _tag: 'Ready' }>

const jsonResponse = (status: number, body: string) =>
  new Response(body, { status, headers: { 'content-type': 'application/json' } })

const page = (response: AudioPageResponse) =>
  jsonResponse(200, JSON.stringify(Schema.encodeSync(AudioPageResponse)(response)))

const httpError = (status: number, tag: string) =>
  jsonResponse(status, JSON.stringify({ ['_tag']: tag }))

const readyPage = (favorite: ReadyPage['favorite'], audioId = track.id) =>
  page(
    AudioPageResponse.cases.Ready.make({
      principal: { id: 'listener-1', name: 'Listener', username: null, image: null, role: 'user' },
      metadata: null,
      favorite,
      audio: {
        id: audioId,
        title: 'Late Night Signal',
        slug: track.slug,
        description: null,
        thumbnailUrl: null,
        url: 'https://cdn.goosebumps.fm/late-night-signal.mp3',
        content: '',
        type: 'mix',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        draft: false,
        tags: [],
        showId: null,
        episodeNumber: null,
        playCount: 0,
        compiledContent: '',
      },
    }),
  )

const outcome = <A, E extends { readonly _tag: string }>(effect: Effect.Effect<A, E>) =>
  Effect.runPromise(
    effect.pipe(
      Effect.map((value) => ({ ok: value })),
      Effect.catch((error) => Effect.succeed({ failed: error._tag })),
    ),
  )

describe('getSessionWithClient', () => {
  test.each([
    ['null session', () => jsonResponse(200, 'null')],
    ['unauthorized', () => httpError(401, 'Unauthorized')],
  ])('reports expiry for %s', async (_name, respond) => {
    const server = fakeServer(respond)

    expect(await outcome(getSessionWithClient(server.connection))).toEqual({
      failed: 'SessionExpired',
    })
  })

  test.each([
    ['malformed session', () => jsonResponse(200, JSON.stringify({ user: { id: 'listener-1' } }))],
    ['invalid JSON', () => jsonResponse(200, '{')],
    ['service unavailable', () => httpError(503, 'ServiceUnavailable')],
    ['network unavailable', () => undefined],
  ])('reports unavailability for %s', async (_name, respond) => {
    const server = fakeServer(respond)

    expect(await outcome(getSessionWithClient(server.connection))).toEqual({
      failed: 'SessionUnavailable',
    })
  })
})

describe('loadFavorite', () => {
  test('reads the current favorite state from the audio page with the bearer session', async () => {
    const server = fakeServer(() => readyPage('active'))

    expect(await outcome(loadFavorite(server.connection, track))).toEqual({ ok: true })
    expect(server.seen).toEqual([
      {
        method: 'GET',
        path: '/api/content/audio/mix/late-night-signal/page',
        authorization: 'Bearer fixture-session-token',
      },
    ])
  })

  test('reports an inactive favorite', async () => {
    const server = fakeServer(() => readyPage('inactive'))

    expect(await outcome(loadFavorite(server.connection, track))).toEqual({ ok: false })
  })

  test('keeps an anonymous page retryable when the bearer session is valid', async () => {
    const server = fakeServer((_method, path) =>
      path === '/auth/get-session'
        ? jsonResponse(
            200,
            JSON.stringify({
              user: {
                id: 'listener-1',
                name: 'Listener',
                email: 'listener@example.test',
                emailVerified: true,
                createdAt: '2026-01-01T00:00:00.000Z',
                updatedAt: '2026-01-01T00:00:00.000Z',
              },
            }),
          )
        : readyPage('anonymous'),
    )

    expect(await outcome(loadFavorite(server.connection, track))).toEqual({
      failed: 'FavoriteRequestFailed',
    })
    expect(server.seen).toEqual([
      {
        method: 'GET',
        path: '/api/content/audio/mix/late-night-signal/page',
        authorization: 'Bearer fixture-session-token',
      },
      {
        method: 'GET',
        path: '/auth/get-session',
        authorization: 'Bearer fixture-session-token',
      },
    ])
  })

  test('reports expiry only after an anonymous page and a rejected bearer session', async () => {
    const server = fakeServer((_method, path) =>
      path === '/auth/get-session' ? httpError(401, 'Unauthorized') : readyPage('anonymous'),
    )

    expect(await outcome(loadFavorite(server.connection, track))).toEqual({
      failed: 'FavoriteSessionExpired',
    })
    expect(server.seen.at(-1)).toEqual({
      method: 'GET',
      path: '/auth/get-session',
      authorization: 'Bearer fixture-session-token',
    })
  })

  test('reports expiry after an anonymous page and a null bearer session', async () => {
    const server = fakeServer((_method, path) =>
      path === '/auth/get-session' ? jsonResponse(200, 'null') : readyPage('anonymous'),
    )

    expect(await outcome(loadFavorite(server.connection, track))).toEqual({
      failed: 'FavoriteSessionExpired',
    })
    expect(server.seen.at(-1)).toEqual({
      method: 'GET',
      path: '/auth/get-session',
      authorization: 'Bearer fixture-session-token',
    })
  })

  test.each([
    ['service unavailable', () => httpError(503, 'ServiceUnavailable')],
    ['network unavailable', () => undefined],
    ['malformed session', () => jsonResponse(200, JSON.stringify({ user: { id: 'listener-1' } }))],
    ['invalid JSON', () => jsonResponse(200, '{')],
  ])('keeps an anonymous page retryable when session lookup has %s', async (_name, respond) => {
    const server = fakeServer((_method, path) =>
      path === '/auth/get-session' ? respond() : readyPage('anonymous'),
    )

    expect(await outcome(loadFavorite(server.connection, track))).toEqual({
      failed: 'FavoriteRequestFailed',
    })
  })

  test('marks missing tracks and slugs that now point at different audio as unavailable', async () => {
    const missing = fakeServer(() =>
      page(AudioPageResponse.cases.NotFound.make({ principal: null })),
    )

    const replaced = fakeServer(() => readyPage('inactive', '0b6e2f0a-8c1d-4e3f-9a7b-5c4d3e2f1a0b'))

    expect(await outcome(loadFavorite(missing.connection, track))).toEqual({
      failed: 'FavoriteTrackUnavailable',
    })
    expect(await outcome(loadFavorite(replaced.connection, track))).toEqual({
      failed: 'FavoriteTrackUnavailable',
    })
  })

  test('surfaces server and favorite lookup failures as retryable request failures', async () => {
    const unavailable = fakeServer(() =>
      page(AudioPageResponse.cases.Unavailable.make({ principal: null })),
    )

    const lookupFailed = fakeServer(() => readyPage('unavailable'))
    const crashed = fakeServer(() => httpError(500, 'InternalServerError'))

    for (const server of [unavailable, lookupFailed, crashed]) {
      expect(await outcome(loadFavorite(server.connection, track))).toEqual({
        failed: 'FavoriteRequestFailed',
      })
    }
  })
})

describe('saveFavorite', () => {
  test('adds and removes the current track through the favorites endpoints', async () => {
    const server = fakeServer(() =>
      jsonResponse(200, JSON.stringify({ success: true, message: 'ok' })),
    )

    expect(await outcome(saveFavorite(server.connection, track, true))).toEqual({ ok: true })
    expect(await outcome(saveFavorite(server.connection, track, false))).toEqual({ ok: false })
    expect(server.seen).toEqual([
      { method: 'POST', path: '/api/favorites', authorization: 'Bearer fixture-session-token' },
      {
        method: 'DELETE',
        path: `/api/favorites/${track.id}`,
        authorization: 'Bearer fixture-session-token',
      },
    ])
  })

  test('treats already-applied intents as success', async () => {
    const alreadyAdded = fakeServer(() => httpError(409, 'Conflict'))
    const alreadyRemoved = fakeServer(() => httpError(404, 'NotFound'))

    expect(await outcome(saveFavorite(alreadyAdded.connection, track, true))).toEqual({ ok: true })
    expect(await outcome(saveFavorite(alreadyRemoved.connection, track, false))).toEqual({
      ok: false,
    })
  })

  test('maps rejected sessions, missing tracks and server failures to typed errors', async () => {
    const expired = fakeServer(() => httpError(401, 'Unauthorized'))
    const missing = fakeServer(() => httpError(404, 'NotFound'))
    const crashed = fakeServer(() => httpError(500, 'InternalServerError'))

    expect(await outcome(saveFavorite(expired.connection, track, true))).toEqual({
      failed: 'FavoriteSessionExpired',
    })
    expect(await outcome(saveFavorite(expired.connection, track, false))).toEqual({
      failed: 'FavoriteSessionExpired',
    })
    expect(await outcome(saveFavorite(missing.connection, track, true))).toEqual({
      failed: 'FavoriteTrackUnavailable',
    })
    expect(await outcome(saveFavorite(crashed.connection, track, true))).toEqual({
      failed: 'FavoriteRequestFailed',
    })
  })
})
