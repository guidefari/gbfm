import { Context, Effect, Layer, Queue } from 'effect'

export interface ReminderSignalService {
  /** Signal that a reminder was created or updated — wakes the processor loop */
  readonly signal: Effect.Effect<void>
  /** Wait until a signal arrives */
  readonly await: Effect.Effect<void>
}

export const ReminderSignalService = Context.Service<ReminderSignalService>('ReminderSignalService')

export const ReminderSignalServiceLive = Layer.effect(
  ReminderSignalService,
  Effect.gen(function* () {
    // dropping(1): if the loop is already awake, extra signals are discarded
    const queue = yield* Queue.dropping<void>(1)
    return {
      signal: Queue.offer(queue, undefined).pipe(Effect.asVoid),
      await: Queue.take(queue).pipe(Effect.asVoid)
    }
  })
)
