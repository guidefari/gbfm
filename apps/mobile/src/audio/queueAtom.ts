import * as Atom from 'effect/unstable/reactivity/Atom'
import { Effect } from 'effect'
import { useAtomSet, useAtomValue } from '@effect/atom-react'
import {
  loadQueue,
  saveQueue,
  type PersistedQueueType,
  type QueueTrackType
} from '@/audio/queueStorage'
import {
  initialQueueState,
  mergeHydratedQueue,
  reduceQueue,
  type QueueAction
} from '@/audio/queueState'

export { initialQueueState, mergeHydratedQueue, reduceQueue, type QueueAction }

type State = PersistedQueueType

type InternalQueueAction =
  | QueueAction
  | { readonly _tag: 'hydrate'; readonly state: State; readonly token: symbol }

let queueWriteTail: Promise<void> = Promise.resolve()
let hydration: { readonly token: symbol; readonly pending: Array<QueueAction> } | null = null

const readQueue = (ctx: Atom.AtomContext): State => {
  const token = Symbol('queue hydration')
  hydration = { token, pending: [] }
  const hydrate = Effect.match(loadQueue(), {
    onFailure: (error) => {
      if (hydration?.token === token) hydration = null
      console.error('Unable to hydrate audio queue', error)
    },
    onSuccess: (persisted) => {
      if (hydration?.token === token) {
        ctx.set(queueAtom, { _tag: 'hydrate', state: persisted ?? initialQueueState, token })
      }
    }
  })
  Effect.runFork(hydrate)
  return initialQueueState
}

const writeQueue = (ctx: Atom.WriteContext<State>, action: InternalQueueAction) => {
  const current = ctx.get(queueAtom)
  if (action._tag === 'hydrate') {
    if (hydration?.token !== action.token) return
    const pending = hydration.pending
    hydration = null
    const next = mergeHydratedQueue(action.state, pending)
    if (next !== current) ctx.setSelf(next)
    if (pending.length > 0) enqueueQueueWrite(next)
    return
  }

  const next = reduceQueue(current, action)
  if (next !== current) ctx.setSelf(next)

  if (next === current && action._tag !== 'clear') return
  if (hydration) {
    hydration.pending.push(action)
    return
  }
  enqueueQueueWrite(next)
}

const enqueueQueueWrite = (state: State) => {
  queueWriteTail = queueWriteTail
    .catch(() => undefined)
    .then(() => Effect.runPromise(saveQueue(state)))
    .catch((error: unknown) => {
      console.error('Unable to persist audio queue', error)
    })
}

export const queueAtom: Atom.Writable<State, InternalQueueAction> = Atom.writable(
  readQueue,
  writeQueue
)

export type QueueView = {
  readonly tracks: ReadonlyArray<QueueTrackType>
  readonly currentIndex: number
  readonly current: QueueTrackType | null
}

const selectQueueView = (state: State): QueueView => ({
  tracks: state.tracks,
  currentIndex: state.currentIndex,
  current: state.currentIndex >= 0 ? (state.tracks[state.currentIndex] ?? null) : null
})

export const useQueue = (): QueueView => useAtomValue(queueAtom, selectQueueView)

export const useQueueDispatch = (): ((action: QueueAction) => void) => useAtomSet(queueAtom)
