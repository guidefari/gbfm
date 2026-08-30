import { Data } from 'effect'

export class ImageRenderError extends Data.TaggedError('ImageRenderError')<{
  readonly message: string
  readonly cause?: unknown
}> {}

export class ImageSaveError extends Data.TaggedError('ImageSaveError')<{
  readonly message: string
  readonly cause?: unknown
}> {}

/** The user closed the share sheet. Not a failure, but it travels the error
 *  channel so the save path stays a single expression. */
export class ImageShareDismissed extends Data.TaggedError('ImageShareDismissed')<{}> {}

export type ImageExportError = ImageRenderError | ImageSaveError
