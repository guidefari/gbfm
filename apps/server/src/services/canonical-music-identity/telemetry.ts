import { Effect, Exit, Option, Result, Schema } from 'effect'
import type { ParsedMusicSource } from './music-source'
import type { EntityReference } from './repository'

const SafeTaggedErrorSchema = Schema.Struct({
  _tag: Schema.Literals([
    'MusicSourceInvalid',
    'MusicIdentityBusy',
    'MusicIdentityAliasCollision',
    'MusicIdentityConflict',
    'MusicIdentityEntityNotFound',
    'MusicIdentitySourceLinkNotFound',
    'MusicIdentityInvalidSnapshot',
    'MusicIdentityProviderRejected',
    'MusicIdentityProviderUnavailable',
    'MusicIdentityStorageError',
    'MusicProviderInvalidInput',
    'MusicProviderNotFound',
    'MusicProviderMisconfigured',
    'MusicProviderRequestFailed',
    'MusicProviderResponseInvalid',
    'MusicScraperError'
  ])
})

type SafeTaggedError = typeof SafeTaggedErrorSchema.Type
type SpanAttributes = Readonly<Record<string, string | number | boolean>>
type SpanOptions = { readonly attributes?: SpanAttributes }

const decodeSafeTaggedError = Schema.decodeUnknownOption(SafeTaggedErrorSchema)

const sourceKeyHash = (sourceKey: string) =>
  Effect.promise(async () => {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(sourceKey))
    return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
  })

export const annotateSource = (source: ParsedMusicSource) =>
  Effect.gen(function* () {
    const hash = yield* sourceKeyHash(source.sourceKey)
    yield* Effect.annotateCurrentSpan({
      platform: source.platform,
      sourceEntityType: source.sourceEntityType,
      sourceKeyHash: hash
    })
  })

export const annotateEntity = (reference: EntityReference) =>
  Effect.annotateCurrentSpan({
    entityType: reference.entityType,
    entityId: reference.entityId
  })

const annotateExit = <A, E>(exit: Exit.Exit<A, E>) => {
  if (Exit.isSuccess(exit)) return Effect.void
  const error = Exit.findError(exit)
  if (Result.isFailure(error)) return Effect.annotateCurrentSpan('outcome', 'failure')
  const safeError = decodeSafeTaggedError(error.success)
  if (Option.isNone(safeError)) return Effect.annotateCurrentSpan('outcome', 'failure')
  return Effect.annotateCurrentSpan({ outcome: 'failure', errorTag: safeError.value._tag })
}

const restoreExit = <A, E>(exit: Exit.Exit<A, E>): Effect.Effect<A, E> =>
  Exit.isSuccess(exit) ? Effect.succeed(exit.value) : Effect.failCause(exit.cause)

export const withSafeSpan =
  (name: string, options?: SpanOptions) =>
  <A, E, R>(operation: Effect.Effect<A, E, R>): Effect.Effect<A, E, R> =>
    Effect.exit(operation).pipe(
      Effect.tap(annotateExit),
      Effect.withSpan(name, options),
      Effect.flatMap(restoreExit)
    )

export const withSafeTypedSpan =
  (name: string, options?: SpanOptions) =>
  <A, E extends SafeTaggedError, R>(operation: Effect.Effect<A, E, R>): Effect.Effect<A, E, R> =>
    operation.pipe(withSafeSpan(name, options))
