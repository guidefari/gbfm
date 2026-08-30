import * as Effect from 'effect/Effect'
import { captureException } from '@/services/analytics'
import { ImageExport, type ImageExportError, type ImageSaveOutcome } from '@/services/image-export'
import type { ImageRenderError } from '@/services/image-export'

const EXPORT_PIXEL_WIDTH = 1080

export type TweetImageRenderRequest = {
  readonly node: HTMLElement
  readonly frameWidth: number
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
  node,
  frameWidth,
  slug,
  format
}: TweetImageRenderRequest): Effect.Effect<Blob, ImageRenderError, ImageExport> =>
  ImageExport.use((imageExport) =>
    imageExport.render(node, {
      pixelRatio: EXPORT_PIXEL_WIDTH / frameWidth,
      cacheBust: true
    })
  ).pipe(reportFailure(slug, format))

export const saveTweetImageEffect = ({
  blob,
  slug,
  format
}: TweetImageSaveRequest): Effect.Effect<ImageSaveOutcome, ImageExportError, ImageExport> =>
  ImageExport.use((imageExport) => imageExport.save(blob, `${slug}-${format}.png`)).pipe(
    reportFailure(slug, format)
  )

/** `blob` is the eagerly pre-rendered PNG for the current format. When it is
 *  absent the tap beat the pre-render, so we rasterize on demand instead. */
export const exportTweetImageEffect = ({
  node,
  frameWidth,
  slug,
  format,
  blob
}: TweetImageExportRequest): Effect.Effect<ImageSaveOutcome, ImageExportError, ImageExport> =>
  Effect.gen(function* () {
    const ready = blob ?? (yield* renderTweetImageEffect({ node, frameWidth, slug, format }))
    return yield* saveTweetImageEffect({ blob: ready, slug, format })
  })
