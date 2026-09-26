import { Data, Match } from 'effect'

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

export class TagsUpdateError extends Data.TaggedError('TagsUpdateError')<{
  readonly message: string
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
  | TagsUpdateError
  | NotSignedInError
  | MissingAudioError

export const isPageRetryable = Match.type<MixUploadPageError>().pipe(
  Match.tags({
    AudioUploadError: ({ status }) => retryableStatus(status),
    ImageUploadError: ({ status }) => retryableStatus(status),
    RecordSaveError: ({ status }) => retryableStatus(status),
  }),
  Match.orElse(() => false),
)

const retryableStatus = (status: number | undefined): boolean =>
  status === undefined || status === 408 || status === 429 || (status >= 500 && status < 600)
