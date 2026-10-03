import { Effect } from 'effect'
import { Mount } from 'foldkit'

import { Message } from './model'

export const SuppressDragClick = Mount.define('Player.SuppressDragClick', {
  args: {},
  messages: [Message.OperationCompleted],
  execute: ({ element }) =>
    Effect.acquireRelease(
      Effect.sync(() => {
        let pointerId: number | null = null
        let startY = 0
        let dragged = false

        const down = (event: Event) => {
          if (!(event instanceof PointerEvent) || event.button !== 0) return
          pointerId = event.pointerId
          startY = event.clientY
          dragged = false
        }

        const move = (event: PointerEvent) => {
          if (event.pointerId === pointerId && Math.abs(event.clientY - startY) > 6) dragged = true
        }

        const up = () => {
          pointerId = null
        }

        const click = (event: Event) => {
          if (dragged && event instanceof MouseEvent && event.detail !== 0) {
            event.preventDefault()
            event.stopImmediatePropagation()
          }

          dragged = false
        }

        element.addEventListener('pointerdown', down)
        document.addEventListener('pointermove', move)
        document.addEventListener('pointerup', up)
        document.addEventListener('pointercancel', up)
        element.addEventListener('click', click, true)

        return () => {
          element.removeEventListener('pointerdown', down)
          document.removeEventListener('pointermove', move)
          document.removeEventListener('pointerup', up)
          document.removeEventListener('pointercancel', up)
          element.removeEventListener('click', click, true)
        }
      }),
      (cleanup) => Effect.sync(cleanup),
    ).pipe(Effect.as(Message.OperationCompleted())),
})
