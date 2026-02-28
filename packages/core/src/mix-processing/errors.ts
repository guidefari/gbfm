import { Data } from 'effect'

export class MixValidationError extends Data.TaggedError('MixValidationError')<{
  readonly message: string
}> {}

export class MixProcessingError extends Data.TaggedError('MixProcessingError')<{
  readonly message: string
  readonly code?: number
}> {}

export class MixFileSystemError extends Data.TaggedError('MixFileSystemError')<{
  readonly message: string
  readonly path?: string
}> {}
