import { Cause, Data, Effect, Exit, Layer } from 'effect'
import { ConfigServiceLayer } from '@/services/config.service'
import { AppLoggerLive } from '@/services/logger.service'

const SLOW_QUERY_THRESHOLD = 100
const VERY_SLOW_QUERY_THRESHOLD = 500

class QueryFailure extends Data.TaggedError('QueryFailure')<{
  readonly cause: unknown
}> {}

export async function timeQuery<T>(queryFn: () => Promise<T>, context: string): Promise<T> {
  const program = Effect.gen(function* () {
    const start = performance.now()
    const result = yield* Effect.tryPromise({
      try: () => queryFn(),
      catch: (cause) => new QueryFailure({ cause })
    })
    const duration = Math.round((performance.now() - start) * 100) / 100

    if (duration > VERY_SLOW_QUERY_THRESHOLD) {
      yield* Effect.logError('[DB] Very slow query', {
        context,
        duration,
        threshold: VERY_SLOW_QUERY_THRESHOLD
      })
    } else if (duration > SLOW_QUERY_THRESHOLD) {
      yield* Effect.logWarning('[DB] Slow query', {
        context,
        duration,
        threshold: SLOW_QUERY_THRESHOLD
      })
    }

    return result
  }).pipe(
    Effect.tapError((failure) =>
      Effect.logError('[DB] Query failed', {
        context,
        error: failure.cause instanceof Error ? failure.cause.message : String(failure.cause)
      })
    ),
    Effect.withSpan('db.query', { attributes: { 'db.context': context } })
  )

  const exit = await Effect.runPromiseExit(
    program.pipe(Effect.provide(AppLoggerLive.pipe(Layer.provide(ConfigServiceLayer))))
  )
  if (Exit.isSuccess(exit)) return exit.value

  const failure = exit.cause.reasons.find(Cause.isFailReason)
  if (failure) {
    const cause = failure.error.cause
    throw cause instanceof Error ? cause : new Error(String(cause))
  }
  throw new Error(Cause.pretty(exit.cause))
}
