import * as Atom from 'effect/unstable/reactivity/Atom'
import { Effect } from 'effect'
import { useAtomSet, useAtomValue } from '@effect/atom-react'
import {
  loadQueue,
  saveQueue,
  type PersistedQueueType,
  type QueueTrackType
} from '@/audio/queueStorage'

type State = PersistedQueueType

export type QueueAction =
  | { readonly _tag: 'enqueue'; readonly track: QueueTrackType; readonly at?: number }
  | {
      readonly _tag: 'enqueueAll'
      readonly tracks: ReadonlyArray<QueueTrackType>
      readonly at?: number
    }
  | { readonly _tag: 'playNow'; readonly track: QueueTrackType }
  | { readonly _tag: 'playIndex'; readonly index: number }
  | { readonly _tag: 'remove'; readonly index: number }
  | { readonly _tag: 'reorder'; readonly from: number; readonly to: number }
  | { readonly _tag: 'clear' }

type InternalQueueAction = QueueAction | { readonly _tag: 'hydrate'; readonly state: State }

const initial: State = { tracks: [], currentIndex: -1 }
let queueRevision = 0
let queueWriteTail: Promise<void> = Promise.resolve()

const clampIndex = (tracks: ReadonlyArray<QueueTrackType>, index: number) =>
  tracks.length === 0 ? -1 : Math.max(0, Math.min(index, tracks.length - 1))

const reduce = (state: Readonly<State>, action: InternalQueueAction): State => {
  switch (action._tag) {
    case 'hydrate':
      return action.state

    case 'enqueue': {
      const existing = state.tracks.findIndex((t) => t.id === action.track.id)
      if (existing !== -1) {
        return { ...state, currentIndex: existing }
      }
      const at = action.at ?? state.tracks.length
      const tracks = [...state.tracks.slice(0, at), action.track, ...state.tracks.slice(at)]
      return { tracks, currentIndex: at }
    }

    case 'enqueueAll': {
      const filtered = action.tracks.filter(
        (t) => !state.tracks.some((existing) => t.id === existing.id)
      )
      if (filtered.length === 0) return state
      const at = action.at ?? state.tracks.length
      const tracks = [...state.tracks.slice(0, at), ...filtered, ...state.tracks.slice(at)]
      return { tracks, currentIndex: at }
    }

    case 'playNow': {
      const existing = state.tracks.findIndex((t) => t.id === action.track.id)
      if (existing !== -1) {
        return { ...state, currentIndex: existing }
      }
      return {
        tracks: [action.track, ...state.tracks],
        currentIndex: 0
      }
    }

    case 'playIndex':
      return { ...state, currentIndex: clampIndex(state.tracks, action.index) }

    case 'remove': {
      if (action.index < 0 || action.index >= state.tracks.length) return state
      const tracks = [
        ...state.tracks.slice(0, action.index),
        ...state.tracks.slice(action.index + 1)
      ]
      let currentIndex = state.currentIndex
      if (tracks.length === 0) {
        currentIndex = -1
      } else if (action.index < currentIndex) {
        currentIndex = currentIndex - 1
      } else if (action.index === currentIndex) {
        currentIndex = clampIndex(tracks, currentIndex)
      }
      return { tracks, currentIndex }
    }

    case 'reorder': {
      if (
        action.from === action.to ||
        action.from < 0 ||
        action.from >= state.tracks.length ||
        action.to < 0 ||
        action.to >= state.tracks.length
      ) {
        return state
      }
      const next = [...state.tracks]
      const [moved] = next.splice(action.from, 1)
      next.splice(action.to, 0, moved)
      const currentId = state.tracks[state.currentIndex]?.id
      const currentIndex = currentId ? next.findIndex((t) => t.id === currentId) : -1
      return { tracks: next, currentIndex }
    }

    case 'clear':
      return initial
  }
}

// SecureStore is async, so the atom reads a synchronous initial state and
// hydrates from storage in the background. The guard prevents a late
// hydration from clobbering queue actions dispatched in the meantime.
const readQueue = (ctx: Atom.AtomContext): State => {
  const revision = ++queueRevision
  const hydrate = Effect.flatMap(loadQueue(), (persisted) =>
    Effect.sync(() => {
      if (persisted === null) return
      if (queueRevision === revision) {
        ctx.set(queueAtom, { _tag: 'hydrate', state: persisted })
      }
    })
  ).pipe(Effect.catch(() => Effect.void))
  void Effect.runFork(hydrate)
  return initial
}

const writeQueue = (ctx: Atom.WriteContext<State>, action: InternalQueueAction) => {
  const current = ctx.get(queueAtom)
  const next = reduce(current, action)
  if (next !== current) ctx.setSelf(next)
  if (action._tag === 'hydrate') return

  queueRevision += 1
  if (next === current && action._tag !== 'clear') return
  queueWriteTail = queueWriteTail.then(() => Effect.runPromise(saveQueue(next)))
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
