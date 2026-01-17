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
