import type { QueueTrackType } from '@gbfm/player'
import { Deferred, Effect, Fiber } from 'effect'
import { describe, expect, it } from 'vitest'

import { createCreatorLookup } from './creator-lookup'
import { CreatorLookupOutcome } from './creator-recovery'

const track: QueueTrackType = {
  id: 'one',
  slug: 'one / mix',
  title: 'One',
  url: '/one.mp3',
  type: 'mix',
  thumbnailUrl: null,
}

const audio = {
  ...track,
  description: null,
  content: '',
  compiledContent: '',
  draft: false,
  tags: null,
  showId: null,
  episodeNumber: null,
  playCount: 0,
  createdAt: '2026-10-10',
  updatedAt: '2026-10-10',
  creators: [{ id: 'creator', name: 'Fixture Creator', username: 'fixture' }],
}

describe('creator lookup boundary', () => {
  it('uses the public type/slug endpoint and decodes authoritative creators', async () => {
    const calls: Array<{ url: string; init: RequestInit | undefined }> = []

    const lookup = createCreatorLookup(async (url, init) => {
      calls.push({ url, init })

      return Response.json(audio)
    })

    const outcome = await Effect.runPromise(lookup(track))
    expect(outcome._tag).toBe('CreatorsFound')
    expect(outcome).toMatchObject({ creators: audio.creators })
    expect(calls[0]?.url).toBe('/api/content/audio/mix/one%20%2F%20mix')
    expect(calls[0]?.init?.credentials).toBe('same-origin')
    expect(calls[0]?.init?.signal).toBeInstanceOf(AbortSignal)
  })

  it.each([404, 401, 403, 408, 429, 500, 501, 502, 503, 504, 505])(
    'classifies HTTP %s',
    async (status) => {
      const lookup = createCreatorLookup(async () => new Response(null, { status }))

      const reason = await Effect.runPromise(
        lookup(track).pipe(
          Effect.match({ onFailure: (error) => error.reason, onSuccess: () => 'success' }),
        ),
      )

      expect(reason).toBe(
        [408, 429, 500, 502, 503, 504].includes(status) ? 'transient' : 'permanent',
      )
    },
  )

  it.each([
    {},
    { ...audio, id: 'different' },
    { ...audio, slug: 'different' },
    { ...audio, type: 'track' },
    { ...audio, creators: undefined },
    { ...audio, creators: [{ id: 'creator', name: '   ', username: null }] },
    { ...audio, creators: [{ id: '', name: 'Creator', username: null }] },
  ])('stops on invalid, mismatched or empty metadata: %j', async (body) => {
    const lookup = createCreatorLookup(async () => Response.json(body))
    expect(
      await Effect.runPromise(
        lookup(track).pipe(
          Effect.match({ onFailure: (error) => error.reason, onSuccess: () => 'success' }),
        ),
      ),
    ).toBe('permanent')
  })
  it('returns authoritative empty creators as successful NoCreators', async () => {
    const lookup = createCreatorLookup(async () => Response.json({ ...audio, creators: [] }))
    expect(await Effect.runPromise(lookup(track))).toEqual(CreatorLookupOutcome.NoCreators())
  })

  it('treats invalid JSON as permanent and transport failures as transient', async () => {
    const invalid = createCreatorLookup(async () => new Response('not json'))
    const unavailable = createCreatorLookup(() => Promise.reject(new Error('offline')))

    const result = (lookup: typeof invalid) =>
      Effect.runPromise(
        lookup(track).pipe(
          Effect.match({ onFailure: (error) => error.reason, onSuccess: () => 'success' }),
        ),
      )

    expect(await result(invalid)).toBe('permanent')
    expect(await result(unavailable)).toBe('transient')
  })
  it('keeps the request abortable after headers arrive and while the body is pending', async () => {
    const received = Deferred.makeUnsafe<AbortSignal>()

    const lookup = createCreatorLookup(async (_url, init) => {
      if (init.signal) Deferred.doneUnsafe(received, Effect.succeed(init.signal))

      return new Response(new ReadableStream())
    })

    await Effect.runPromise(
      Effect.gen(function* () {
        const fiber = yield* lookup(track).pipe(Effect.forkScoped)
        const signal = yield* Deferred.await(received)
        yield* Effect.yieldNow
        expect(signal.aborted).toBe(false)
        yield* Fiber.interrupt(fiber)
        expect(signal.aborted).toBe(true)
      }).pipe(Effect.scoped),
    )
  })
})
