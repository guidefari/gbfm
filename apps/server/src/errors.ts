import { Data, Option, Schema } from 'effect'

const DRIZZLE_QUERY_FAILURE = /^Failed query:/i
const PostgresFailureCause = Schema.Struct({
  code: Schema.String.pipe(Schema.check(Schema.isPattern(/^[A-Z0-9]{5}$/)))
})
const decodePostgresFailureCause = Schema.decodeUnknownOption(PostgresFailureCause)

function databaseFailureSummary(error: Error): string {
  const cause = Option.getOrUndefined(decodePostgresFailureCause(error.cause))
  if (cause) return `Database query failed (${cause.code})`

  return 'Database query failed'
}

/**
 * Extracts a human-readable, telemetry-safe message from any error type.
 *
 * @param error - The error to extract a message from
 * @returns The error message string
 *
 * @example
 * getErrorMessage(new Error('Something went wrong'))
 * // => 'Something went wrong'
 *
 * @example
 * getErrorMessage('Connection failed')
 * // => 'Connection failed'
 *
 * @example
 * getErrorMessage({ code: 500 })
 * // => 'Unknown error'
 */
export function getErrorMessage(cause: unknown): string {
  if (cause instanceof Error) {
    return DRIZZLE_QUERY_FAILURE.test(cause.message)
      ? databaseFailureSummary(cause)
      : cause.message.replace(/\nparams:[\s\S]*$/i, '')
  }
  const message = Schema.decodeUnknownOption(Schema.String)(cause)
  if (Option.isSome(message)) return message.value
  return 'Unknown error'
}

export class EmailError extends Data.TaggedError('EmailError')<{
  readonly message: string
  readonly reminderId?: string
  readonly emailAddress?: string
}> {}

export class DatabaseError extends Data.TaggedError('DatabaseError')<{
  readonly message: string
  readonly operation: string
  readonly table?: string
}> {}

export class CryptoError extends Data.TaggedError('CryptoError')<{
  readonly message: string
  readonly operation: 'encrypt' | 'decrypt' | 'keyResolve'
}> {}

export class BlueskyProviderError extends Data.TaggedError('BlueskyProviderError')<{
  readonly message: string
  readonly operation: 'resolveIdentity' | 'login' | 'refresh' | 'feed'
}> {}

export class IdentityResolutionError extends Data.TaggedError('IdentityResolutionError')<{
  readonly message: string
}> {}

export class LockUnavailable extends Data.TaggedError('LockUnavailable')<{
  readonly key: string
}> {}

export class ReminderProcessingError extends Data.TaggedError('ReminderProcessingError')<{
  readonly message: string
  readonly reminderId: string
  readonly stage: 'query' | 'email' | 'update'
}> {}

export class SitemapCacheError extends Data.TaggedError('SitemapCacheError')<{
  readonly message: string
}> {}

export class ReminderQueueUnavailable extends Data.TaggedError('ReminderQueueUnavailable')<{
  readonly reminderId: string
}> {}

export class NotFoundError extends Data.TaggedError('NotFoundError')<{
  readonly message: string
  readonly resource?: string
  readonly id?: string
}> {}

export class UnauthorizedError extends Data.TaggedError('UnauthorizedError')<{
  readonly message: string
  readonly userId?: string
}> {}

export class ValidationError extends Data.TaggedError('ValidationError')<{
  readonly message: string
  readonly field?: string
  readonly value?: unknown
}> {}

export class ConflictError extends Data.TaggedError('ConflictError')<{
  readonly message: string
  readonly resource?: string
  readonly id?: string
}> {}

export class ParentPostNotReplyableError extends Data.TaggedError('ParentPostNotReplyableError')<{
  readonly message: string
  readonly parentSlug: string
  readonly parentType: string
}> {}

export class QuotedPostNotEmbeddableError extends Data.TaggedError('QuotedPostNotEmbeddableError')<{
  readonly message: string
  readonly quotedPostId: string
  readonly quotedPostType: string
}> {}

export class S3Error extends Data.TaggedError('S3Error')<{
  readonly message: string
  readonly operation: string
  readonly key?: string
}> {}

// Shared by every music provider integration (Spotify, Bandcamp, ...) so a
// caller can tell a client-fixable input problem from an upstream outage
// without inspecting an HTTP status. Mirrors the Deezer* errors in
// deezer.service.ts, which already model their failures this way.
export class MusicProviderInvalidInput extends Data.TaggedError('MusicProviderInvalidInput')<{
  readonly message: string
  readonly operation: string
}> {}

export class MusicProviderNotFound extends Data.TaggedError('MusicProviderNotFound')<{
  readonly operation: string
  readonly entityType: string
  readonly externalId: string
}> {}

export class MusicProviderMisconfigured extends Data.TaggedError('MusicProviderMisconfigured')<{
  readonly message: string
  readonly operation: string
}> {}

export class MusicProviderRequestFailed extends Data.TaggedError('MusicProviderRequestFailed')<{
  readonly message: string
  readonly operation: string
  readonly statusCode?: number
}> {}

// The provider answered, but not in a shape we can read: a parse failure or a
// response that no longer matches the schema. Distinct from RequestFailed
// because it means the integration is broken rather than merely unavailable.
export class MusicProviderResponseInvalid extends Data.TaggedError('MusicProviderResponseInvalid')<{
  readonly message: string
  readonly operation: string
}> {}

export type MusicProviderError =
  | MusicProviderInvalidInput
  | MusicProviderNotFound
  | MusicProviderMisconfigured
  | MusicProviderRequestFailed
  | MusicProviderResponseInvalid

// Service-specific tagged errors
export class AudioServiceError extends Data.TaggedError('AudioServiceError')<{
  readonly message: string
  readonly operation: string
  readonly audioId?: string
  readonly slug?: string
}> {}

export class FavoriteServiceError extends Data.TaggedError('FavoriteServiceError')<{
  readonly message: string
  readonly operation: string
  readonly userId?: string
  readonly favoriteId?: string
}> {}

export class UserServiceError extends Data.TaggedError('UserServiceError')<{
  readonly message: string
  readonly operation: string
  readonly userId?: string
  readonly email?: string
}> {}

export class PostServiceError extends Data.TaggedError('PostServiceError')<{
  readonly message: string
  readonly operation: string
  readonly postId?: string
}> {}

export class ReleaseServiceError extends Data.TaggedError('ReleaseServiceError')<{
  readonly message: string
  readonly operation: string
  readonly releaseId?: string
}> {}

export class LabelServiceError extends Data.TaggedError('LabelServiceError')<{
  readonly message: string
  readonly operation: string
  readonly labelId?: string
}> {}

export class MusicReminderServiceError extends Data.TaggedError('MusicReminderServiceError')<{
  readonly message: string
  readonly operation: string
  readonly reminderId?: string
}> {}

export class ConfigServiceError extends Data.TaggedError('ConfigServiceError')<{
  readonly message: string
  readonly operation: string
  readonly configKey?: string
}> {}

export class BackupError extends Data.TaggedError('BackupError')<{
  readonly message: string
  readonly operation: string
  readonly filename?: string
}> {}

export class RestoreError extends Data.TaggedError('RestoreError')<{
  readonly message: string
  readonly operation: string
  readonly filename?: string
}> {}

export class LoggerError extends Data.TaggedError('LoggerError')<{
  readonly message: string
  readonly operation: string
}> {}

export class FetchError extends Data.TaggedError('FetchError')<{
  readonly message: string
  readonly cause?: unknown
}> {}

export class ProcessingError extends Data.TaggedError('ProcessingError')<{
  readonly message: string
  readonly code?: number
}> {}

export class FileSystemError extends Data.TaggedError('FileSystemError')<{
  readonly message: string
  readonly path?: string
}> {}
