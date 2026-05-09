import { Cause, Data, Effect, Exit } from 'effect'

const SLOW_QUERY_THRESHOLD = 100
const VERY_SLOW_QUERY_THRESHOLD = 500

class QueryFailure extends Data.TaggedError('QueryFailure')<{
  readonly cause: unknown
}> {}

let runtimePromise: Promise<typeof import('@/runtime').AppRuntime> | undefined
const getRuntime = () => {
  runtimePromise ??= import('@/runtime').then((m) => m.AppRuntime)
  return runtimePromise
}

export async function timeQuery<T>(
  queryFn: () => Promise<T>,
  context: string
): Promise<T> {
  const AppRuntime = await getRuntime()

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
        error:
          failure.cause instanceof Error
            ? failure.cause.message
            : String(failure.cause)
      })
    ),
    Effect.withSpan('db.query', { attributes: { 'db.context': context } })
  )

  const exit = await AppRuntime.runPromiseExit(program)
  if (Exit.isSuccess(exit)) return exit.value

  const failure = Cause.failureOption(exit.cause)
  if (failure._tag === 'Some') {
    const cause = failure.value.cause
    throw cause instanceof Error ? cause : new Error(String(cause))
  }
  throw new Error(Cause.pretty(exit.cause))
}
