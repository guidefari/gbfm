import {
  AudioEngine,
  makeAudioPlayback,
  PlayerStorageInMemory,
  PlayReporterNoop,
  type AudioPlaybackController,
  type QueueTrackType,
} from '@gbfm/player'
import {
  Deferred,
  Effect,
  Layer,
  ManagedRuntime,
  Predicate,
  Queue,
  type Scope,
  Stream,
} from 'effect'
import { TestClock } from 'effect/testing'
import { describe, expect, it } from 'vitest'

import { createCreatorLookup } from './creator-lookup'
import {
  CreatorLookupFailed,
  CreatorLookupOutcome,
  recoverPlayerCreators,
  type CreatorLookup,
  type CreatorRecovery,
  CreatorRecoveryState,
} from './creator-recovery'

const creators: [NonNullable<QueueTrackType['creators']>[number]] = [
  { id: 'creator', name: 'Fixture Creator', username: 'fixture' },
]

const found = CreatorLookupOutcome.CreatorsFound({ creators })

const track: QueueTrackType = {
  id: 'one',
  slug: 'one',
  title: 'One',
  url: '/one.mp3',
  type: 'mix',
  thumbnailUrl: null,
}

const backendAudio = {
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
  creators: [],
}

const waitForState = (recovery: CreatorRecovery, tag: CreatorRecoveryState['_tag']) =>
  Effect.gen(function* () {
    const current = recovery.getState(track.id)

    if (Predicate.isTagged(current, tag)) return current
    const observed = yield* Deferred.make<CreatorRecoveryState>()

    const unsubscribe = recovery.subscribeState((id, state) => {
      if (id === track.id && Predicate.isTagged(state, tag))
        Deferred.doneUnsafe(observed, Effect.succeed(state))
    })

    yield* Effect.addFinalizer(() => Effect.sync(unsubscribe))

    return yield* Deferred.await(observed)
  })

const run = async (
  test: (controller: AudioPlaybackController) => Effect.Effect<void, never, Scope.Scope>,
) => {
  const runtime = ManagedRuntime.make(
    Layer.mergeAll(
      TestClock.layer(),
      PlayerStorageInMemory,
      PlayReporterNoop,
      Layer.succeed(AudioEngine, {
        replace: () => Effect.void,
        clearSource: Effect.void,
        play: Effect.void,
        pause: Effect.void,
        seekTo: () => Effect.void,
        setVolume: () => Effect.void,
        setMuted: () => Effect.void,
        currentStatus: Effect.succeed({
          sourceGeneration: null,
          isLoaded: false,
          playing: false,
          didJustFinish: false,
          currentTime: 0,
          duration: 0,
          isBuffering: false,
        }),
        changes: Stream.never,
        setNowPlaying: () => Effect.void,
        setPositionState: () => Effect.void,
        setCommandHandlers: () => Effect.void,
      }),
    ),
  )

  try {
    await runtime.runPromise(
      Effect.gen(function* () {
        const controller = yield* makeAudioPlayback(runtime)
        yield* Effect.yieldNow
        yield* test(controller)
      }).pipe(Effect.scoped),
    )
  } finally {
    await runtime.dispose()
  }
}

describe('lazy player creator recovery', () => {
  it('makes an authoritative HTTP empty-creators response terminal across playback changes and readdition', () =>
    run((controller) =>
      Effect.gen(function* () {
        let requests = 0

        const lookup = createCreatorLookup(async () => {
          requests += 1

          return Response.json(backendAudio)
        })

        const recovery = yield* recoverPlayerCreators(controller, lookup)
        expect(recovery.getState(track.id)).toEqual(CreatorRecoveryState.Idle())
        yield* controller.playAll([track, { ...track, id: 'two', creators }])
        expect(recovery.getState(track.id)).toEqual(CreatorRecoveryState.Waiting())
        yield* TestClock.adjust('500 millis')
        expect(yield* waitForState(recovery, 'NoCreators')).toEqual(
          CreatorRecoveryState.NoCreators({ attempts: 1 }),
        )
        yield* controller.setVolume(55)
        yield* controller.pause
        yield* controller.play
        yield* controller.playNext
        yield* controller.playPrevious
        yield* controller.clearQueue
        yield* controller.playTrack({ ...track })
        yield* TestClock.adjust('1 minute')
        expect(requests).toBe(1)
        expect(recovery.getState(track.id)).toEqual(
          CreatorRecoveryState.NoCreators({ attempts: 1 }),
        )
        expect(controller.getSnapshot().queue.current?.creators).toBeUndefined()
      }),
    ))

  it.each([404, 503])(
    'distinguishes HTTP %s from authoritative no creators and remains terminal',
    (status) =>
      run((controller) =>
        Effect.gen(function* () {
          let requests = 0
          const observed = yield* Queue.unbounded<number>()

          const recovery = yield* recoverPlayerCreators(
            controller,
            createCreatorLookup(async () => {
              requests += 1
              Queue.offerUnsafe(observed, requests)

              return new Response(null, { status })
            }),
          )

          const transitions: Array<CreatorRecoveryState> = []

          const unsubscribe = recovery.subscribeState((id, state) => {
            if (id === track.id) transitions.push(state)
          })

          yield* Effect.addFinalizer(() => Effect.sync(unsubscribe))
          yield* controller.playTrack(track)
          yield* TestClock.adjust('500 millis')
          yield* Queue.take(observed)

          if (status === 503) {
            expect(yield* waitForState(recovery, 'Retrying')).toEqual(
              CreatorRecoveryState.Retrying({ attempts: 1 }),
            )
            yield* TestClock.adjust('1 second')
            yield* Queue.take(observed)
            yield* waitForState(recovery, 'Retrying')
            yield* TestClock.adjust('2 seconds')
            yield* Queue.take(observed)
          }

          const terminal = status === 404 ? 'PermanentFailure' : 'RetriesExhausted'

          const expected =
            status === 404
              ? CreatorRecoveryState.PermanentFailure({ attempts: 1 })
              : CreatorRecoveryState.RetriesExhausted({ attempts: 3 })

          expect(yield* waitForState(recovery, terminal)).toEqual(expected)
          expect(transitions).toEqual(
            status === 404
              ? [
                  CreatorRecoveryState.Waiting(),
                  CreatorRecoveryState.LookingUp({ attempt: 1 }),
                  CreatorRecoveryState.PermanentFailure({ attempts: 1 }),
                ]
              : [
                  CreatorRecoveryState.Waiting(),
                  CreatorRecoveryState.LookingUp({ attempt: 1 }),
                  CreatorRecoveryState.Retrying({ attempts: 1 }),
                  CreatorRecoveryState.LookingUp({ attempt: 2 }),
                  CreatorRecoveryState.Retrying({ attempts: 2 }),
                  CreatorRecoveryState.LookingUp({ attempt: 3 }),
                  CreatorRecoveryState.RetriesExhausted({ attempts: 3 }),
                ],
          )
          yield* controller.pause
          yield* controller.play
          yield* controller.clearQueue
          yield* controller.playTrack({ ...track })
          yield* TestClock.adjust('1 minute')
          expect(requests).toBe(status === 404 ? 1 : 3)
          expect(recovery.getState(track.id)).toEqual(expected)
        }),
      ),
  )

  it('defers a rapidly deselected track without HTTP, then recovers on a later selection', () =>
    run((controller) =>
      Effect.gen(function* () {
        let requests = 0

        const recovery = yield* recoverPlayerCreators(
          controller,
          createCreatorLookup(async () => {
            requests += 1

            return Response.json({ ...backendAudio, creators })
          }),
        )

        yield* controller.playAll([track, { ...track, id: 'two', creators }])
        yield* TestClock.adjust('250 millis')
        yield* controller.playNext
        yield* TestClock.adjust('250 millis')
        expect(yield* waitForState(recovery, 'Deferred')).toEqual(CreatorRecoveryState.Deferred())
        expect(requests).toBe(0)
        yield* controller.playPrevious
        expect(recovery.getState(track.id)).toEqual(CreatorRecoveryState.Waiting())
        yield* TestClock.adjust('500 millis')
        expect(yield* waitForState(recovery, 'Recovered')).toEqual(
          CreatorRecoveryState.Recovered({ attempts: 1 }),
        )
        expect(requests).toBe(1)
      }),
    ))
  it.each([
    { missing: [] },
    { missing: [{ id: 'creator', name: '   ', username: null }] },
    { missing: [{ id: '', name: 'Creator', username: null }] },
  ])('recovers blank creator metadata: %j', ({ missing }) =>
    run((controller) =>
      Effect.gen(function* () {
        const repaired = yield* Deferred.make<void>()

        const unsubscribe = controller.subscribeSnapshot((snapshot) => {
          if (snapshot.queue.current?.creators?.[0]?.name === 'Fixture Creator')
            Deferred.doneUnsafe(repaired, Effect.void)
        })

        yield* Effect.addFinalizer(() => Effect.sync(unsubscribe))
        yield* recoverPlayerCreators(controller, () => Effect.succeed(found))
        yield* controller.playTrack({ ...track, creators: missing })
        yield* TestClock.adjust('500 millis')
        yield* Deferred.await(repaired)
        expect(controller.getSnapshot().queue.current?.creators).toEqual(creators)
      }),
    ),
  )

  it('interrupts in-flight recovery when its browser scope closes', () =>
    run((controller) =>
      Effect.gen(function* () {
        const started = yield* Deferred.make<void>()
        let attempts = 0
        let interrupted = 0

        const recovery = yield* Effect.gen(function* () {
          const recovery = yield* recoverPlayerCreators(controller, () =>
            Effect.gen(function* () {
              attempts += 1
              yield* Effect.addFinalizer(() =>
                Effect.sync(() => {
                  interrupted += 1
                }),
              )
              yield* Deferred.succeed(started, undefined)

              return yield* Effect.never
            }).pipe(Effect.scoped),
          )

          yield* controller.playTrack(track)
          yield* TestClock.adjust('500 millis')
          yield* Deferred.await(started)

          return recovery
        }).pipe(Effect.scoped)

        yield* TestClock.adjust('1 minute')
        expect(attempts).toBe(1)
        expect(interrupted).toBe(1)
        expect(controller.getSnapshot().queue.current?.creators).toBeUndefined()
        expect(recovery.getState(track.id)).toEqual(CreatorRecoveryState.Cancelled({ attempts: 1 }))
      }),
    ))
  it('skips complete creators and noncurrent queue entries, defers and deduplicates missing metadata', () =>
    run((controller) =>
      Effect.gen(function* () {
        const calls: Array<string> = []
        const repaired = yield* Deferred.make<void>()

        const unsubscribe = controller.subscribeSnapshot((snapshot) => {
          if (snapshot.queue.current?.id === 'two' && snapshot.queue.current.creators?.length)
            Deferred.doneUnsafe(repaired, Effect.void)
        })

        yield* Effect.addFinalizer(() => Effect.sync(unsubscribe))
        yield* recoverPlayerCreators(controller, (entry) =>
          Effect.sync(() => {
            calls.push(entry.id)

            return found
          }),
        )
        yield* controller.playAll([
          { ...track, creators },
          { ...track, id: 'two' },
        ])
        yield* TestClock.adjust('10 seconds')
        expect(calls).toEqual([])
        yield* controller.playFromQueue(1)
        yield* controller.setVolume(55)
        expect(calls).toEqual([])
        yield* TestClock.adjust('500 millis')
        yield* Deferred.await(repaired)
        expect(calls).toEqual(['two'])
        expect(controller.getSnapshot().queue.current?.creators).toEqual(creators)
      }),
    ))

  it.each([true, false])(
    'retries transient failures at most three times, eventual success: %s',
    (success) =>
      run((controller) =>
        Effect.gen(function* () {
          let attempts = 0
          const observed = yield* Queue.unbounded<number>()

          const lookup: CreatorLookup = () =>
            Effect.suspend(() => {
              attempts += 1
              Queue.offerUnsafe(observed, attempts)

              return success && attempts === 3
                ? Effect.succeed(found)
                : Effect.fail(new CreatorLookupFailed({ reason: 'transient' }))
            })

          yield* recoverPlayerCreators(controller, lookup)
          yield* controller.playTrack(track)
          yield* TestClock.adjust('500 millis')
          yield* Queue.take(observed)
          expect(attempts).toBe(1)
          yield* TestClock.adjust('1 second')
          yield* Queue.take(observed)
          expect(attempts).toBe(2)
          yield* TestClock.adjust('2 seconds')
          yield* Queue.take(observed)
          expect(attempts).toBe(3)
          yield* controller.pause
          yield* controller.play
          yield* TestClock.adjust('1 minute')
          expect(attempts).toBe(3)
          expect(controller.getSnapshot().queue.current?.creators).toEqual(
            success ? creators : undefined,
          )
        }),
      ),
  )

  it.each(['permanent', 'empty'])('stops on %s results', (result) =>
    run((controller) =>
      Effect.gen(function* () {
        let attempts = 0
        const observed = yield* Deferred.make<void>()
        yield* recoverPlayerCreators(controller, () =>
          Effect.suspend(() => {
            attempts += 1
            Deferred.doneUnsafe(observed, Effect.void)

            return result === 'empty'
              ? Effect.succeed(CreatorLookupOutcome.NoCreators())
              : Effect.fail(new CreatorLookupFailed({ reason: 'permanent' }))
          }),
        )
        yield* controller.playTrack(track)
        yield* TestClock.adjust('1 minute')
        yield* Deferred.await(observed)
        yield* controller.setVolume(50)
        yield* TestClock.adjust('1 minute')
        expect(attempts).toBe(1)
        expect(controller.getSnapshot().queue.current?.creators).toBeUndefined()
      }),
    ),
  )

  it.each(['removed', 'changed', 'removed-and-readded'])(
    'discards a response when the entry was %s in flight',
    (change) =>
      run((controller) =>
        Effect.gen(function* () {
          const response = yield* Deferred.make<CreatorLookupOutcome>()
          const started = yield* Deferred.make<void>()

          const recovery = yield* recoverPlayerCreators(controller, () =>
            Deferred.succeed(started, undefined).pipe(Effect.andThen(Deferred.await(response))),
          )

          yield* controller.playTrack(track)
          yield* TestClock.adjust('500 millis')
          yield* Deferred.await(started)

          if (change === 'changed')
            yield* controller.playAll([
              {
                ...track,
                title: 'Changed',
                creators: [{ id: 'other', name: 'Other', username: null }],
              },
            ])
          else {
            yield* controller.clearQueue

            if (change === 'removed-and-readded') yield* controller.playTrack(track)
          }

          yield* Deferred.succeed(response, found)
          yield* TestClock.adjust('1 second')
          expect(recovery.getState(track.id)).toEqual(CreatorRecoveryState.Stale({ attempts: 1 }))
          expect(controller.getSnapshot().queue.current?.creators).toEqual(
            change === 'changed' ? [{ id: 'other', name: 'Other', username: null }] : undefined,
          )
        }),
      ),
  )

  it('times out each attempt and stops after the third timeout', () =>
    run((controller) =>
      Effect.gen(function* () {
        let attempts = 0
        let interrupted = 0
        const observed = yield* Queue.unbounded<number>()
        const stopped = yield* Queue.unbounded<number>()

        const recovery = yield* recoverPlayerCreators(controller, () =>
          Effect.gen(function* () {
            attempts += 1
            yield* Queue.offer(observed, attempts)
            yield* Effect.addFinalizer(() =>
              Effect.sync(() => {
                interrupted += 1
                Queue.offerUnsafe(stopped, interrupted)
              }),
            )

            return yield* Effect.never
          }).pipe(Effect.scoped),
        )

        yield* controller.playTrack(track)
        yield* TestClock.adjust('500 millis')
        yield* Queue.take(observed)
        yield* TestClock.adjust('5 seconds')
        yield* Queue.take(stopped)
        yield* TestClock.adjust('1 second')
        yield* Queue.take(observed)
        yield* TestClock.adjust('5 seconds')
        yield* Queue.take(stopped)
        yield* TestClock.adjust('2 seconds')
        yield* Queue.take(observed)
        yield* TestClock.adjust('5 seconds')
        yield* Queue.take(stopped)
        expect(attempts).toBe(3)
        expect(interrupted).toBe(3)
        expect(yield* waitForState(recovery, 'RetriesExhausted')).toEqual(
          CreatorRecoveryState.RetriesExhausted({ attempts: 3 }),
        )
      }),
    ))

  it('repairs the original queued entry without replacing a newly selected track', () =>
    run((controller) =>
      Effect.gen(function* () {
        const response = yield* Deferred.make<CreatorLookupOutcome>()
        const started = yield* Deferred.make<void>()
        const repaired = yield* Deferred.make<void>()

        const unsubscribe = controller.subscribeSnapshot((snapshot) => {
          if (snapshot.queue.tracks.find((entry) => entry.id === track.id)?.creators?.length)
            Deferred.doneUnsafe(repaired, Effect.void)
        })

        yield* Effect.addFinalizer(() => Effect.sync(unsubscribe))
        yield* recoverPlayerCreators(controller, () =>
          Deferred.succeed(started, undefined).pipe(Effect.andThen(Deferred.await(response))),
        )
        yield* controller.playAll([track, { ...track, id: 'two', creators }])
        yield* TestClock.adjust('500 millis')
        yield* Deferred.await(started)
        yield* controller.playFromQueue(1)
        yield* controller.reorderQueue(0, 1)
        yield* Deferred.succeed(response, found)
        yield* Deferred.await(repaired)
        expect(controller.getSnapshot().queue.current?.id).toBe('two')
        expect(controller.getSnapshot().queue.tracks[1]?.creators).toEqual(creators)
      }),
    ))
})
