import { Stream } from 'effect'
import { Dom } from 'foldkit'

export type ScrollState = {
  readonly y: number
  readonly minimized: boolean
}

const topZone = 48

const travel = 16

export const nextScrollState = (state: ScrollState, y: number): ScrollState => {
  if (y <= topZone) return { y, minimized: false }

  const delta = y - state.y

  return Math.abs(delta) < travel ? state : { y, minimized: delta > 0 }
}

export const navMinimizeEvents = <Message>(
  minimized: boolean,
  toMessage: (minimized: boolean) => Message,
) =>
  Dom.streamFromEvent({
    target: window,
    type: 'scroll',
    mapEvent: () => window.scrollY,
    options: { passive: true },
  }).pipe(
    Stream.mapAccum(
      (): ScrollState => ({ y: window.scrollY, minimized }),
      (state, y) => {
        const next = nextScrollState(state, y)

        return [next, next.minimized === state.minimized ? [] : [toMessage(next.minimized)]]
      },
    ),
  )
