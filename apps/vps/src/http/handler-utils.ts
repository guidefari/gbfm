import { Effect } from 'effect'
import { HttpServerRequest } from 'effect/unstable/http'
import { Auth } from '@/lib/auth'

// For routes with no AuthMiddleware (public, but drafts/scoped content
// should still open for an admin or the resource's own creator) -- reads
// the session cookie directly and tolerates no-session/errors as "public
// viewer" instead of rejecting the request the way AuthMiddleware does.
export const getOptionalActor = Effect.gen(function* () {
  const request = yield* HttpServerRequest.HttpServerRequest
  const auth = yield* Auth
  const session = yield* Effect.tryPromise({
    try: () => auth.api.getSession({ headers: new Headers(request.headers) }),
    catch: () => null
  }).pipe(Effect.orElseSucceed(() => null))

  return session ? { userId: session.user.id, userRole: session.user.role ?? 'user' } : undefined
})

type DatabaseErrorTag = { readonly _tag: 'DatabaseError' }

// Undeclared DatabaseError becomes a logged defect (500), same as the old
// runEffect's fallback for anything that wasn't a mapped HttpError. Shared
// across handler groups instead of copy-pasted per group (each copy was
// identical except the log-tag prefix) -- flagged in review on PR #162.
export const dieOnDatabaseError =
  (logTag: string) =>
  <A, E, R>(effect: Effect.Effect<A, E | DatabaseErrorTag, R>) =>
    effect.pipe(
      Effect.tapErrorTag('DatabaseError', (cause) =>
        Effect.logError(`[${logTag}] database operation failed`, cause)
      ),
      Effect.catchTag('DatabaseError', (cause) => Effect.die(cause))
    )

type S3ErrorTag = { readonly _tag: 'S3Error' }

// Same shape as dieOnDatabaseError -- no upload endpoint declares S3Error in
// its HttpApiEndpoint error schema (it's an unexpected infra failure, not a
// client-fixable validation error), so it becomes a logged defect (500 +
// Sentry capture via the global SentryLive middleware) instead of an
// undeclared-object type error at the schema layer.
export const dieOnS3Error =
  (logTag: string) =>
  <A, E, R>(effect: Effect.Effect<A, E | S3ErrorTag, R>) =>
    effect.pipe(
      Effect.tapErrorTag('S3Error', (cause) =>
        Effect.logError(`[${logTag}] S3 operation failed`, cause)
      ),
      Effect.catchTag('S3Error', (cause) => Effect.die(cause))
    )

type PlatformErrorTag = { readonly _tag: 'PlatformError' }

// Same shape as dieOnDatabaseError/dieOnS3Error. Reading a multipart part
// back off the temp file this same request just wrote (upload group) can
// only realistically fail on disk-full/permissions edge cases -- an
// unexpected infra failure, not something a client can fix by resubmitting
// differently, so no endpoint declares PlatformError in its error schema.
export const dieOnPlatformError =
  (logTag: string) =>
  <A, E, R>(effect: Effect.Effect<A, E | PlatformErrorTag, R>) =>
    effect.pipe(
      Effect.tapErrorTag('PlatformError', (cause) =>
        Effect.logError(`[${logTag}] filesystem operation failed`, cause)
      ),
      Effect.catchTag('PlatformError', (cause) => Effect.die(cause))
    )
