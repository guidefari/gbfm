import {
  PlayerStorage,
  type AudioStorageError,
  type PersistedQueueType,
  type PlayerStorageContract
} from '@gbfm/player'
import { Data, Effect, Layer, Scope } from 'effect'
import { PlayerStorageLive } from '@/audio/queueStorage'

const appScope = Scope.makeUnsafe()
const contextPromise = Effect.runPromise(Layer.buildWithScope(PlayerStorageLive, appScope))

class QueuePersistenceUnavailable extends Data.TaggedError('QueuePersistenceUnavailable')<{
  readonly cause: unknown
}> {}

export const runAppEffect = <A, E>(effect: Effect.Effect<A, E, PlayerStorage>) =>
  contextPromise.then((context) => Effect.runPromiseWith(context)(effect))

const use = <A>(
  operation: (storage: PlayerStorageContract) => Effect.Effect<A, AudioStorageError>
) =>
  Effect.tryPromise({
    try: () => runAppEffect(Effect.flatMap(PlayerStorage, operation)),
    catch: (cause) => new QueuePersistenceUnavailable({ cause })
  })

/** Queue persistence bound to the app context, for the queue atom, which runs
 *  outside React and so cannot use the player's per-mount runtime. */
export const queuePersistence = {
  loadQueue: () => use((storage) => storage.loadQueue),
  saveQueue: (queue: PersistedQueueType) => use((storage) => storage.saveQueue(queue))
}
