import { Effect, Schema } from 'effect'
import { Mount } from 'foldkit'

import { Message } from '../../../message'

const positions = new Map<string, number>()

export const PreserveBrowseScroll = Mount.define('TweetBrowse.PreserveScroll', {
  args: { key: Schema.String, selected: Schema.NullOr(Schema.String) },
  messages: [Message.NavigationCompleted],
  execute: ({ element, key }) =>
    Effect.acquireRelease(
      Effect.sync(() => {
        let restoring = true
        let interacting = false
        let frame = 0
        const saved = positions.get(key) ?? 0

        const save = () => {
          if (!restoring && interacting && element.getClientRects().length)
            positions.set(key, element.scrollTop)
        }

        const clicked = () => {
          if (element.getClientRects().length) positions.set(key, element.scrollTop)
          interacting = false
        }

        const interacted = () => {
          interacting = true
        }

        frame = requestAnimationFrame(() => {
          if (element.getClientRects().length) element.scrollTop = saved
          frame = requestAnimationFrame(() => {
            if (element.getClientRects().length) element.scrollTop = saved
            restoring = false
          })
        })
        element.addEventListener('scroll', save, { passive: true })
        element.addEventListener('click', clicked, true)
        element.addEventListener('wheel', interacted, { passive: true })
        element.addEventListener('touchstart', interacted, { passive: true })
        element.addEventListener('pointerdown', interacted, { passive: true })
        element.addEventListener('keydown', interacted)

        return () => {
          cancelAnimationFrame(frame)
          element.removeEventListener('scroll', save)
          element.removeEventListener('click', clicked, true)
          element.removeEventListener('wheel', interacted)
          element.removeEventListener('touchstart', interacted)
          element.removeEventListener('pointerdown', interacted)
          element.removeEventListener('keydown', interacted)
        }
      }),
      (cleanup) => Effect.sync(cleanup),
    ).pipe(Effect.as(Message.NavigationCompleted())),
})
