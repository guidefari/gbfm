import { Data } from 'effect'

export class AudioUploadAborted extends Data.TaggedError('AudioUploadAborted')<{
  readonly message: string
}> {}

export class AudioUploadPaused extends Data.TaggedError('AudioUploadPaused')<{
  readonly message: string
}> {}

export class AudioUploadError extends Data.TaggedError('AudioUploadError')<{
  readonly message: string
  readonly status?: number
}> {}

export class ImageUploadError extends Data.TaggedError('ImageUploadError')<{
  readonly message: string
  readonly status?: number
}> {}

export class RecordSaveError extends Data.TaggedError('RecordSaveError')<{
  readonly message: string
  readonly status?: number
}> {}

export class NotSignedInError extends Data.TaggedError('NotSignedInError')<{
  readonly message: string
}> {}

export class MissingAudioError extends Data.TaggedError('MissingAudioError')<{
  readonly message: string
}> {}

export type MixUploadPageError =
  | AudioUploadAborted
  | AudioUploadPaused
  | AudioUploadError
  | ImageUploadError
  | RecordSaveError
  | NotSignedInError
  | MissingAudioError

export const isPageRetryable = (error: MixUploadPageError): boolean => {
  if (
    error._tag === 'AudioUploadError' ||
    error._tag === 'ImageUploadError' ||
    error._tag === 'RecordSaveError'
  ) {
    if (error.status === undefined) return true
    return (
      error.status === 408 || error.status === 429 || (error.status >= 500 && error.status < 600)
    )
  }
  return false
}
