import * as Context from 'effect/Context'
import type * as Effect from 'effect/Effect'
import type { ImageRenderError, ImageSaveError } from './errors'

export type ImageRenderOptions = {
  readonly pixelRatio: number
  readonly cacheBust: boolean
}

/** How the image reached the user, so callers can tailor confirmation copy. */
export type ImageSaveOutcome = 'shared' | 'dismissed' | 'downloaded'

export interface ImageExportService {
  /** Rasterizes a DOM subtree to a PNG blob. */
  readonly render: (
    node: HTMLElement,
    options: ImageRenderOptions
  ) => Effect.Effect<Blob, ImageRenderError>
  /** Hands the file to the OS share sheet where available, else downloads it. */
  readonly save: (blob: Blob, fileName: string) => Effect.Effect<ImageSaveOutcome, ImageSaveError>
  /** Whether `save` will open a share sheet, for button copy. */
  readonly canShareFiles: Effect.Effect<boolean>
}

export class ImageExport extends Context.Service<ImageExport, ImageExportService>()(
  '@gbfm/www/ImageExport'
) {}
