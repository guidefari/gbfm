import { Effect } from 'effect'
import { DEDUP_WINDOW_MS } from './audioStorage'

type PlayDeliveryDependencies<CheckError, DeliveryError, RememberError> = {
  readonly isWithinDedupWindow: (trackId: string) => Effect.Effect<boolean, CheckError, never>
  readonly deliver: (trackId: string) => Effect.Effect<void, DeliveryError, never>
  readonly remember: (trackId: string) => Effect.Effect<void, RememberError, never>
  readonly now: () => number
}

export const createPlayDelivery = <CheckError, DeliveryError, RememberError>(
  dependencies: PlayDeliveryDependencies<CheckError, DeliveryError, RememberError>
) => {
  const successfulDeliveries = new Map<string, number>()

  return (trackId: string) =>
    Effect.gen(function* () {
      const deliveredAt = successfulDeliveries.get(trackId)
      if (deliveredAt !== undefined && dependencies.now() - deliveredAt < DEDUP_WINDOW_MS) return

      const within = yield* dependencies
        .isWithinDedupWindow(trackId)
        .pipe(Effect.catch(() => Effect.succeed(false)))
      if (within) return

      yield* dependencies.deliver(trackId)
      successfulDeliveries.set(trackId, dependencies.now())
      yield* dependencies.remember(trackId).pipe(Effect.catch(() => Effect.void))
    })
}
