import { Data } from 'effect'

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
