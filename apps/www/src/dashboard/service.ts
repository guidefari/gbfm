import type { PlayerPreferences } from '@gbfm/player'
import { Context, Data, Effect, Layer } from 'effect'

import { preferencesKey, readPlayerPreferences } from '../player/preferences'
import { type DashboardDocument, emptyDocument, parseDashboardDocument } from './document'

export class DashboardRequestError extends Data.TaggedError('DashboardRequestError')<{
  readonly status: number | null
  readonly message: string
}> {}

export interface DashboardRequest {
  readonly path: string
  readonly method?: 'GET' | 'PATCH' | 'PUT' | 'POST' | 'DELETE'
  readonly body?: string
}

export interface DashboardOperations {
  readonly request: (
    request: DashboardRequest,
  ) => Effect.Effect<DashboardDocument, DashboardRequestError>
  readonly readPlayerPreferences: Effect.Effect<PlayerPreferences>
  readonly writePlayerPreferences: (
    preferences: PlayerPreferences,
  ) => Effect.Effect<void, DashboardRequestError>
}

export class DashboardService extends Context.Service<DashboardService, DashboardOperations>()(
  '@gbfm/www/DashboardService',
) {}

const sameOriginPath = (path: string) => {
  const origin = globalThis.location?.origin ?? 'http://localhost'
  const url = new URL(path, origin)

  if (url.origin !== origin)
    throw new DashboardRequestError({
      status: null,
      message: 'Cross-origin dashboard request blocked',
    })

  return url
}

export const makeDashboardServiceLayer = (fetchImplementation: typeof fetch = globalThis.fetch) =>
  Layer.succeed(DashboardService, {
    request: ({ path, method = 'GET', body }) =>
      Effect.tryPromise({
        try: async (signal) => {
          const response = await fetchImplementation(sameOriginPath(path), {
            method,
            signal,
            credentials: 'include',
            headers: body === undefined ? undefined : { 'content-type': 'application/json' },
            body,
          })

          if (!response.ok)
            throw new DashboardRequestError({
              status: response.status,
              message:
                response.status === 403
                  ? 'You do not have access to this operation.'
                  : 'Request failed.',
            })

          if (response.status === 204) return null

          return response.json()
        },
        catch: (cause) =>
          cause instanceof DashboardRequestError
            ? cause
            : new DashboardRequestError({
                status: null,
                message: 'Could not reach the dashboard API.',
              }),
      }).pipe(
        Effect.flatMap((input) =>
          method === 'GET' ? parseDashboardDocument(path, input) : Effect.succeed(emptyDocument),
        ),
        Effect.mapError((cause) =>
          cause instanceof DashboardRequestError
            ? cause
            : new DashboardRequestError({ status: null, message: 'Invalid dashboard response.' }),
        ),
      ),
    readPlayerPreferences: Effect.sync(() => readPlayerPreferences(() => globalThis.localStorage)),
    writePlayerPreferences: (preferences) =>
      Effect.try({
        try: () => globalThis.localStorage.setItem(preferencesKey, JSON.stringify(preferences)),
        catch: () =>
          new DashboardRequestError({ status: null, message: 'Could not save player settings.' }),
      }),
  })

export const DashboardServiceLive = makeDashboardServiceLayer()
