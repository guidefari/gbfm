import { AsyncLocalStorage } from 'node:async_hooks'
import { Data, Effect, type Tracer } from 'effect'

export class AuthTracingError extends Data.TaggedError('AuthTracingError')<{
  operation: string
  cause: unknown
}> {}

const signupRequestParentSpans = new Map<string, Tracer.AnySpan>()
const signupTraceIdStorage = new AsyncLocalStorage<string>()
const dbCallerHintStorage = new AsyncLocalStorage<string>()

export function runWithDbCallerHint<A>(hint: string, fn: () => A) {
  return dbCallerHintStorage.run(hint, fn)
}

export function getCurrentDbCallerHint() {
  return dbCallerHintStorage.getStore()
}

export function setSignupRequestParentSpan(
  traceId: string,
  span: Tracer.AnySpan
) {
  signupRequestParentSpans.set(traceId, span)
}

export function clearSignupRequestParentSpan(traceId: string) {
  signupRequestParentSpans.delete(traceId)
}

export function withSignupRequestParentSpan<A, E, R>(
  effect: Effect.Effect<A, E, R>,
  traceId: string | null | undefined
) {
  const parentSpan = traceId ? signupRequestParentSpans.get(traceId) : undefined

  return parentSpan ? Effect.withParentSpan(effect, parentSpan) : effect
}

export function runWithSignupTraceId<A>(traceId: string, fn: () => A) {
  return signupTraceIdStorage.run(traceId, fn)
}

export function getCurrentSignupTraceId() {
  return signupTraceIdStorage.getStore()
}

export function toAuthTracingError(operation: string, cause: unknown) {
  return new AuthTracingError({ operation, cause })
}

export function getAuthTracingErrorMessage(error: AuthTracingError) {
  return error.cause instanceof Error
    ? error.cause.message
    : String(error.cause)
}
