import { PlayerStorage, type PersistedQueueType, type PlayerStorageShape } from '@gbfm/player'
import { Effect, Layer, Scope } from 'effect'
import { PlayerStorageLive } from '@/audio/queueStorage'

const appScope = Scope.makeUnsafe()
const contextPromise = Effect.runPromise(Layer.buildWithScope(PlayerStorageLive, appScope))

export const runAppEffect = <A, E>(effect: Effect.Effect<A, E, PlayerStorage>) =>
  contextPromise.then((context) => Effect.runPromiseWith(context)(effect))

const use = <A, E>(operation: (storage: PlayerStorageShape) => Effect.Effect<A, E>) =>
  Effect.tryPromise({
    try: () => runAppEffect(Effect.flatMap(PlayerStorage, operation)),
    catch: (error) => error
  })

/** Queue persistence bound to the app context, for the queue atom, which runs
 *  outside React and so cannot use the player's per-mount runtime. */
export const queuePersistence = {
  loadQueue: () => use((storage) => storage.loadQueue()),
  saveQueue: (queue: PersistedQueueType) => use((storage) => storage.saveQueue(queue))
}
