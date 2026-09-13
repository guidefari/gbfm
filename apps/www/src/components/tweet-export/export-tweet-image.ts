import * as Effect from 'effect/Effect'
import { captureException } from '@/services/analytics'
import { ImageExport, type ImageExportError, type ImageSaveOutcome } from '@/services/image-export'
import type { ImageRenderError } from '@/services/image-export'

export type TweetImageRenderRequest = {
  readonly imageUrl: string
  readonly slug: string
  readonly format: string
}

export type TweetImageSaveRequest = {
  readonly blob: Blob
  readonly slug: string
  readonly format: string
}

export type TweetImageExportRequest = TweetImageRenderRequest & {
  readonly blob: Blob | null
}

const reportFailure =
  (slug: string, format: string) =>
  <A, E extends ImageExportError, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E, R> =>
    Effect.tapError(effect, (error) =>
      captureException(error, { feature: 'tweet-export', stage: error._tag, slug, format })
    )

export const renderTweetImageEffect = ({
  imageUrl,
  slug,
  format
}: TweetImageRenderRequest): Effect.Effect<Blob, ImageRenderError, ImageExport> =>
  ImageExport.use((imageExport) => imageExport.load(imageUrl)).pipe(reportFailure(slug, format))

export const saveTweetImageEffect = ({
  blob,
  slug,
  format
}: TweetImageSaveRequest): Effect.Effect<ImageSaveOutcome, ImageExportError, ImageExport> =>
  ImageExport.use((imageExport) => imageExport.save(blob, `${slug}-${format}.png`)).pipe(
    reportFailure(slug, format)
  )

/** `blob` is the eagerly loaded PNG for the current format. When it is absent,
 * the tap beat the preload, so the image is loaded on demand instead. */
export const exportTweetImageEffect = ({
  imageUrl,
  slug,
  format,
  blob
}: TweetImageExportRequest): Effect.Effect<ImageSaveOutcome, ImageExportError, ImageExport> =>
  Effect.gen(function* () {
    const ready = blob ?? (yield* renderTweetImageEffect({ imageUrl, slug, format }))
    return yield* saveTweetImageEffect({ blob: ready, slug, format })
  })
