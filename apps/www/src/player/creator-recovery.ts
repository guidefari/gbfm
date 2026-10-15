import {
  hasCompleteCreators,
  type AudioPlaybackController,
  type QueueTrackType,
} from '@gbfm/player'
import { Data, Effect, Predicate, Schedule, Scope } from 'effect'

type Creators = NonNullable<QueueTrackType['creators']>

export type CreatorLookupOutcome =
  | {
      readonly _tag: 'CreatorsFound'
      readonly creators: readonly [Creators[number], ...Array<Creators[number]>]
    }
  | { readonly _tag: 'NoCreators' }

export const CreatorLookupOutcome = Data.taggedEnum<CreatorLookupOutcome>()

export class CreatorLookupFailed extends Data.TaggedError('CreatorLookupFailed')<{
  readonly reason: 'transient' | 'permanent'
}> {}

export type CreatorLookup = (
  track: QueueTrackType,
) => Effect.Effect<CreatorLookupOutcome, CreatorLookupFailed>

export type CreatorRecoveryState =
  | { readonly _tag: 'Idle' }
  | { readonly _tag: 'Waiting' }
  | { readonly _tag: 'Deferred' }
  | { readonly _tag: 'LookingUp'; readonly attempt: number }
  | { readonly _tag: 'Retrying'; readonly attempts: number }
  | { readonly _tag: 'Recovered'; readonly attempts: number }
  | { readonly _tag: 'NoCreators'; readonly attempts: number }
  | { readonly _tag: 'PermanentFailure'; readonly attempts: number }
  | { readonly _tag: 'RetriesExhausted'; readonly attempts: number }
  | { readonly _tag: 'Stale'; readonly attempts: number }
  | { readonly _tag: 'Cancelled'; readonly attempts: number }

export const CreatorRecoveryState = Data.taggedEnum<CreatorRecoveryState>()

const State = CreatorRecoveryState

const idle = State.Idle()

type StateListener = (trackId: string, state: CreatorRecoveryState) => void

export type CreatorRecovery = {
  readonly getState: (trackId: string) => CreatorRecoveryState
  readonly subscribeState: (listener: StateListener) => () => void
}

export const recoverPlayerCreators = (controller: AudioPlaybackController, lookup: CreatorLookup) =>
  Effect.gen(function* () {
    const scope = yield* Scope.Scope
    const context = yield* Effect.context()
    const states = new Map<string, CreatorRecoveryState>()
    const listeners = new Set<StateListener>()
    const getState = (trackId: string) => states.get(trackId) ?? idle

    const setState = (trackId: string, state: CreatorRecoveryState) => {
      states.set(trackId, state)

      for (const listener of listeners) listener(trackId, state)
    }

    const recover = (original: QueueTrackType) =>
      Effect.gen(function* () {
        let valid = true
        let attempts = 0

        const unsubscribe = controller.subscribeSnapshot((snapshot) => {
          if (!snapshot.queue.tracks.includes(original)) {
            valid = false
            setState(original.id, State.Stale({ attempts }))
          }
        })

        yield* Effect.addFinalizer(() =>
          Effect.sync(() => {
            unsubscribe()
            const state = getState(original.id)

            if (
              Predicate.isTagged(state, 'Waiting') ||
              Predicate.isTagged(state, 'LookingUp') ||
              Predicate.isTagged(state, 'Retrying')
            ) {
              setState(original.id, State.Cancelled({ attempts }))
            }
          }),
        )
        yield* Effect.sleep('500 millis')

        if (!valid) return

        if (controller.getSnapshot().queue.current !== original) {
          setState(original.id, State.Deferred())

          return
        }

        const request = Effect.suspend(() => {
          if (!valid) return Effect.fail(new CreatorLookupFailed({ reason: 'permanent' }))
          attempts += 1
          setState(original.id, State.LookingUp({ attempt: attempts }))

          return lookup(original)
        }).pipe(
          Effect.timeout('5 seconds'),
          Effect.mapError((error) =>
            Predicate.isTagged(error, 'TimeoutError')
              ? new CreatorLookupFailed({ reason: 'transient' })
              : error,
          ),
          Effect.tapError((error) =>
            Effect.sync(() => {
              if (valid && error.reason === 'transient' && attempts < 3)
                setState(original.id, State.Retrying({ attempts }))
            }),
          ),
          Effect.retry({
            while: (error) => error.reason === 'transient',
            schedule: Schedule.exponential('1 second').pipe(Schedule.upTo({ times: 2 })),
          }),
        )

        yield* request.pipe(
          Effect.matchEffect({
            onFailure: (error) =>
              Effect.sync(() => {
                if (valid)
                  setState(
                    original.id,
                    error.reason === 'permanent'
                      ? State.PermanentFailure({ attempts })
                      : State.RetriesExhausted({ attempts }),
                  )
              }),
            onSuccess: (outcome) =>
              Effect.gen(function* () {
                if (!valid) return
                unsubscribe()
                yield* CreatorLookupOutcome.$match(outcome, {
                  NoCreators: () =>
                    Effect.sync(() => setState(original.id, State.NoCreators({ attempts }))),
                  CreatorsFound: ({ creators }) =>
                    controller
                      .repairCreators(original, creators)
                      .pipe(
                        Effect.andThen(
                          Effect.sync(() => setState(original.id, State.Recovered({ attempts }))),
                        ),
                      ),
                })
              }),
          }),
        )
      }).pipe(Effect.scoped)

    const unsubscribe = controller.subscribeSnapshot((snapshot) => {
      const current = snapshot.queue.current

      if (!current || hasCompleteCreators(current)) return
      const state = getState(current.id)

      if (!Predicate.isTagged(state, 'Idle') && !Predicate.isTagged(state, 'Deferred')) return
      setState(current.id, State.Waiting())
      Effect.runSyncWith(context)(
        recover(current).pipe(Effect.forkIn(scope, { startImmediately: true })),
      )
    })

    yield* Effect.addFinalizer(() => Effect.sync(unsubscribe))

    return {
      getState,
      subscribeState: (listener: StateListener) => {
        listeners.add(listener)

        return () => listeners.delete(listener)
      },
    }
  })
