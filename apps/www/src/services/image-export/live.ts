import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'

import { ImageRenderError, ImageSaveError, ImageShareDismissed } from './errors'
import { ImageExport, type ImageSaveOutcome } from './service'

const OBJECT_URL_TTL_MS = 10_000

const canShareFiles = Effect.sync(() => 'navigator' in globalThis && 'canShare' in navigator)

const isAbort = (cause: unknown) => cause instanceof DOMException && cause.name === 'AbortError'

const load = (url: string) =>
  Effect.tryPromise({
    try: async () => {
      const response = await fetch(url)

      if (!response.ok) throw new Error(`Image request returned ${response.status}`)

      return response.blob()
    },
    catch: (cause) => new ImageRenderError({ message: 'image request failed', cause }),
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
            : new ImageSaveError({ message: 'share failed', cause }),
      }).pipe(
        Effect.as<ImageSaveOutcome>('shared'),
        Effect.catchTag('ImageShareDismissed', () => Effect.succeed<ImageSaveOutcome>('dismissed')),
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
      catch: (cause) => new ImageSaveError({ message: 'download failed', cause }),
    })
  })

export const ImageExportLive = Layer.sync(ImageExport, () => ({
  load,
  save,
  canShareFiles,
}))
