import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import { toBlob, toPng } from 'html-to-image'
import { ImageRenderError, ImageSaveError, ImageShareDismissed } from './errors'
import { ImageExport, type ImageRenderOptions, type ImageSaveOutcome } from './service'

const OBJECT_URL_TTL_MS = 10_000

const isWebKit = () => {
  if (!('navigator' in globalThis)) return false
  return /AppleWebKit/.test(navigator.userAgent) && !/Chrome\//.test(navigator.userAgent)
}

const canShareFiles = Effect.sync(() => 'navigator' in globalThis && 'canShare' in navigator)

const isAbort = (cause: unknown) => cause instanceof DOMException && cause.name === 'AbortError'

const render = (node: HTMLElement, options: ImageRenderOptions) =>
  Effect.gen(function* () {
    // WebKit rasterizes the first render before embedded images finish
    // decoding, dropping the artwork; warm-up renders work around it
    if (isWebKit()) {
      yield* Effect.tryPromise({
        try: () => toPng(node, options).then(() => toPng(node, options)),
        catch: (cause) => new ImageRenderError({ message: 'webkit warm-up render failed', cause })
      })
    }

    const blob = yield* Effect.tryPromise({
      try: () => toBlob(node, options),
      catch: (cause) => new ImageRenderError({ message: 'rasterization failed', cause })
    })

    if (!blob) {
      return yield* new ImageRenderError({ message: 'rasterization produced no blob' })
    }

    return blob
  })

/** Data URLs above a small cap are silently dropped by iOS Safari, so the
 *  file always travels as a blob: through the share sheet or an object URL. */
const save = (blob: Blob, fileName: string): Effect.Effect<ImageSaveOutcome, ImageSaveError> =>
  Effect.gen(function* () {
    const file = new File([blob], fileName, { type: 'image/png' })

    if (navigator.canShare?.({ files: [file] })) {
      return yield* Effect.tryPromise({
        try: () => navigator.share({ files: [file] }),
        catch: (cause) =>
          isAbort(cause)
            ? new ImageShareDismissed()
            : new ImageSaveError({ message: 'share failed', cause })
      }).pipe(
        Effect.as<ImageSaveOutcome>('shared'),
        Effect.catchTag('ImageShareDismissed', () => Effect.succeed<ImageSaveOutcome>('dismissed'))
      )
    }

    return yield* Effect.try({
      try: (): ImageSaveOutcome => {
        const objectUrl = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = objectUrl
        link.download = fileName
        link.rel = 'noopener'
        document.body.appendChild(link)
        link.click()
        link.remove()
        setTimeout(() => URL.revokeObjectURL(objectUrl), OBJECT_URL_TTL_MS)
        return 'downloaded'
      },
      catch: (cause) => new ImageSaveError({ message: 'download failed', cause })
    })
  })

export const ImageExportLive = Layer.sync(ImageExport, () => ({
  render,
  save,
  canShareFiles
}))
