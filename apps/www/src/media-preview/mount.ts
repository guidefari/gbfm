import { Effect, Queue, Stream } from 'effect'
import { Mount } from 'foldkit'

import { Message } from '../message'
import {
  browserPreviewSession,
  isPrivateMedia,
  previewDeniedEvent,
  type PreviewSession,
} from './session'

/** One stable root observer covers SSR images and images added by client navigation. */
export const ObservePrivateMedia = Mount.defineStream('MediaPreview.Observe', {
  messages: [Message.MediaPreviewDenied],
  execute: ({ element }) =>
    Stream.callback<typeof Message.MediaPreviewDenied.Type>((queue) =>
      Effect.gen(function* () {
        yield* Effect.acquireRelease(
          Effect.sync(() => {
            const images = new Map<HTMLImageElement, { url: string; session: PreviewSession }>()
            const denied = () => Queue.offerUnsafe(queue, Message.MediaPreviewDenied())
            window.addEventListener(previewDeniedEvent, denied)

            const scan = () => {
              for (const [image, entry] of images) {
                const src =
                  image.getAttribute('data-private-media-src') ?? image.getAttribute('src')

                if (!element.contains(image) || (src !== null && src !== entry.url)) {
                  entry.session.dispose()
                  images.delete(image)

                  if (src && !isPrivateMedia(src)) image.removeAttribute('crossorigin')
                }
              }

              element.querySelectorAll('img').forEach((image) => {
                const url =
                  image.getAttribute('data-private-media-src') ?? image.getAttribute('src')

                if (!url || !isPrivateMedia(url) || images.has(image)) return
                image.removeAttribute('src')
                image.removeAttribute('srcset')
                image.crossOrigin = 'use-credentials'
                const session = browserPreviewSession(url)
                images.set(image, { url, session })
                // The session owns cancellation and converts every request failure to a result.
                void session.ensure().then((result) => {
                  if (
                    result.ok &&
                    images.get(image)?.session === session &&
                    element.contains(image)
                  )
                    image.src = url
                })
              })
            }

            const observer = new MutationObserver(scan)
            observer.observe(element, {
              childList: true,
              subtree: true,
              attributes: true,
              attributeFilter: ['src', 'srcset', 'data-private-media-src'],
            })
            scan()

            return () => {
              observer.disconnect()
              window.removeEventListener(previewDeniedEvent, denied)

              for (const { session } of images.values()) session.dispose()
              images.clear()
            }
          }),
          (cleanup) => Effect.sync(cleanup),
        )

        return yield* Effect.never
      }),
    ),
})
