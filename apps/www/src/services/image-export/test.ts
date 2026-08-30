import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import type { ImageRenderError, ImageSaveError } from './errors'
import { ImageExport, type ImageSaveOutcome } from './service'

export type ImageExportStub = {
  readonly render?: Effect.Effect<Blob, ImageRenderError>
  readonly save?: Effect.Effect<ImageSaveOutcome, ImageSaveError>
  readonly canShareFiles?: boolean
  readonly onSave?: (fileName: string) => void
}

export const ImageExportStubLayer = (stub: ImageExportStub = {}) =>
  Layer.sync(ImageExport, () => ({
    render: () => stub.render ?? Effect.succeed(new Blob()),
    save: (_blob: Blob, fileName: string) => {
      stub.onSave?.(fileName)
      return stub.save ?? Effect.succeed<ImageSaveOutcome>('downloaded')
    },
    canShareFiles: Effect.succeed(stub.canShareFiles ?? false)
  }))
