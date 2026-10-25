import { CompiledAudioResponse } from '@gbfm/api/audio'
import { hasCompleteCreators } from '@gbfm/player'
import { Effect, Schema } from 'effect'

import { CreatorLookupFailed, CreatorLookupOutcome, type CreatorLookup } from './creator-recovery'

export const createCreatorLookup =
  (request: (url: string, init: RequestInit) => Promise<Response>): CreatorLookup =>
  (track) =>
    Effect.gen(function* () {
      const controller = yield* Effect.acquireRelease(
        Effect.sync(() => new AbortController()),
        (controller) => Effect.sync(() => controller.abort()),
      )

      const response = yield* Effect.tryPromise({
        try: () =>
          request(`/api/content/audio/${track.type}/${encodeURIComponent(track.slug)}`, {
            credentials: 'same-origin',
            signal: controller.signal,
          }),
        catch: () => new CreatorLookupFailed({ reason: 'transient' }),
      })

      if (!response.ok)
        return yield* Effect.fail(
          new CreatorLookupFailed({
            reason: [408, 429, 500, 502, 503, 504].includes(response.status)
              ? 'transient'
              : 'permanent',
          }),
        )

      const json = yield* Effect.tryPromise({
        try: () => response.json(),
        catch: (cause) =>
          new CreatorLookupFailed({
            reason: cause instanceof SyntaxError ? 'permanent' : 'transient',
          }),
      })

      const audio = yield* Schema.decodeUnknownEffect(CompiledAudioResponse)(json).pipe(
        Effect.mapError(() => new CreatorLookupFailed({ reason: 'permanent' })),
      )

      const credits = audio.artists?.length ? audio.artists : audio.creators

      if (
        audio.id !== track.id ||
        audio.type !== track.type ||
        audio.slug !== track.slug ||
        !credits
      ) {
        return yield* Effect.fail(new CreatorLookupFailed({ reason: 'permanent' }))
      }

      const [first, ...rest] = credits

      if (!first) return CreatorLookupOutcome.NoCreators()

      if (!hasCompleteCreators({ ...audio, creators: credits }))
        return yield* Effect.fail(new CreatorLookupFailed({ reason: 'permanent' }))

      return CreatorLookupOutcome.CreatorsFound({ creators: [first, ...rest] })
    }).pipe(Effect.scoped)
