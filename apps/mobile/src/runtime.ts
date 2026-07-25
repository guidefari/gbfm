import { PlayerStorage, type PlayerStorageShape } from '@gbfm/player'
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

/** Storage bound to the app context, for callers that run effects themselves
 *  (the player core) rather than composing them into the runtime. */
export const playerStorage: PlayerStorageShape = {
  loadQueue: () => use((storage) => storage.loadQueue()),
  saveQueue: (queue) => use((storage) => storage.saveQueue(queue)),
  loadPosition: (trackId) => use((storage) => storage.loadPosition(trackId)),
  savePosition: (trackId, position) => use((storage) => storage.savePosition(trackId, position)),
  clearPosition: (trackId) => use((storage) => storage.clearPosition(trackId)),
  recordPlay: (trackId) => use((storage) => storage.recordPlay(trackId)),
  isWithinDedupWindow: (trackId) => use((storage) => storage.isWithinDedupWindow(trackId))
}
