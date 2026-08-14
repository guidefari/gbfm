import { Effect } from 'effect'
import * as Atom from 'effect/unstable/reactivity/Atom'
import type { PersistedQueueType, QueueTrackType } from './persistedQueue'
import { initialQueueState, mergeHydratedQueue, reduceQueue, type QueueAction } from './queueState'

type State = PersistedQueueType

export type InternalQueueAction =
  | QueueAction
  | { readonly _tag: 'hydrate'; readonly state: State; readonly token: symbol }

export type QueueView = {
  readonly tracks: ReadonlyArray<QueueTrackType>
  readonly currentIndex: number
  readonly current: QueueTrackType | null
}

export type QueueAtomStorage<LoadError, SaveError> = {
  readonly loadQueue: () => Effect.Effect<State | null, LoadError, never>
  readonly saveQueue: (state: State) => Effect.Effect<void, SaveError, never>
}

export type QueueAtomHandle = {
  readonly queueAtom: Atom.Writable<State, InternalQueueAction>
  readonly selectQueueView: (state: State) => QueueView
}

export const selectQueueView = (state: State): QueueView => ({
  tracks: state.tracks,
  currentIndex: state.currentIndex,
  current: state.currentIndex >= 0 ? (state.tracks[state.currentIndex] ?? null) : null
})

export const makeQueueAtom = <LoadError, SaveError>({
  loadQueue,
  saveQueue,
  onError = (message, error) => console.error(message, error)
}: QueueAtomStorage<LoadError, SaveError> & {
  readonly onError?: (message: string, error: Error) => void
}): QueueAtomHandle => {
  let queueWriteTail: Promise<void> = Promise.resolve()
  let hydration: { readonly token: symbol; readonly pending: Array<QueueAction> } | null = null

  const enqueueQueueWrite = (state: State) => {
    queueWriteTail = queueWriteTail
      .catch(() => undefined)
      .then(() => Effect.runPromise(saveQueue(state)))
      .catch((cause) => {
        onError(
          'Unable to persist audio queue',
          new Error('Unable to persist audio queue', { cause })
        )
      })
  }

  const readQueue = (ctx: Atom.AtomContext): State => {
    const token = Symbol('queue hydration')
    hydration = { token, pending: [] }
    const hydrate = Effect.match(loadQueue(), {
      onFailure: (error) => {
        onError(
          'Unable to hydrate audio queue',
          new Error('Unable to hydrate audio queue', { cause: error })
        )
        if (hydration?.token === token) {
          ctx.set(queueAtom, { _tag: 'hydrate', state: initialQueueState, token })
        }
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

  const queueAtom: Atom.Writable<State, InternalQueueAction> = Atom.writable(readQueue, writeQueue)

  return { queueAtom, selectQueueView }
}
