import { Data } from 'effect'

/**
 * Extracts a human-readable message from any error type.
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
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
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

export class ReminderProcessingError extends Data.TaggedError(
  'ReminderProcessingError'
)<{
  readonly message: string
  readonly reminderId: string
  readonly stage: 'query' | 'email' | 'update'
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

export class S3Error extends Data.TaggedError('S3Error')<{
  readonly message: string
  readonly operation: string
  readonly key?: string
}> {}

export class SpotifyError extends Data.TaggedError('SpotifyError')<{
  readonly message: string
  readonly operation: string
  readonly statusCode?: number
}> {}

// Service-specific tagged errors
export class AudioServiceError extends Data.TaggedError('AudioServiceError')<{
  readonly message: string
  readonly operation: string
  readonly audioId?: string
  readonly slug?: string
}> {}

export class FavoriteServiceError extends Data.TaggedError(
  'FavoriteServiceError'
)<{
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

export class PublicationServiceError extends Data.TaggedError(
  'PublicationServiceError'
)<{
  readonly message: string
  readonly operation: string
  readonly publicationId?: string
}> {}

export class ReleaseServiceError extends Data.TaggedError(
  'ReleaseServiceError'
)<{
  readonly message: string
  readonly operation: string
  readonly releaseId?: string
}> {}

export class LabelServiceError extends Data.TaggedError('LabelServiceError')<{
  readonly message: string
  readonly operation: string
  readonly labelId?: string
}> {}

export class MusicReminderServiceError extends Data.TaggedError(
  'MusicReminderServiceError'
)<{
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
