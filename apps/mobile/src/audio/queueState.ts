import type { PersistedQueueType, QueueTrackType } from '@/audio/persistedQueue'

export type QueueAction =
  | { readonly _tag: 'enqueue'; readonly track: QueueTrackType; readonly at?: number }
  | {
      readonly _tag: 'enqueueAll'
      readonly tracks: ReadonlyArray<QueueTrackType>
      readonly at?: number
    }
  | { readonly _tag: 'playNow'; readonly track: QueueTrackType }
  | { readonly _tag: 'playAll'; readonly tracks: ReadonlyArray<QueueTrackType> }
  | { readonly _tag: 'playIndex'; readonly index: number }
  | { readonly _tag: 'remove'; readonly index: number }
  | { readonly _tag: 'reorder'; readonly from: number; readonly to: number }
  | { readonly _tag: 'clear' }

export const initialQueueState: PersistedQueueType = { tracks: [], currentIndex: -1 }

const clampIndex = (tracks: ReadonlyArray<QueueTrackType>, index: number) =>
  tracks.length === 0 ? -1 : Math.max(0, Math.min(index, tracks.length - 1))

export const reduceQueue = (
  state: Readonly<PersistedQueueType>,
  action: QueueAction
): PersistedQueueType => {
  switch (action._tag) {
    case 'enqueue': {
      const existing = state.tracks.findIndex((track) => track.id === action.track.id)
      if (existing !== -1) return state
      const at = Math.max(0, Math.min(action.at ?? state.tracks.length, state.tracks.length))
      const tracks = [...state.tracks.slice(0, at), action.track, ...state.tracks.slice(at)]
      const currentIndex = state.currentIndex >= at ? state.currentIndex + 1 : state.currentIndex
      return { tracks, currentIndex }
    }

    case 'enqueueAll': {
      const knownIds = new Set(state.tracks.map((track) => track.id))
      const filtered = action.tracks.filter((track) => {
        if (knownIds.has(track.id)) return false
        knownIds.add(track.id)
        return true
      })
      if (filtered.length === 0) return state
      const at = Math.max(0, Math.min(action.at ?? state.tracks.length, state.tracks.length))
      const tracks = [...state.tracks.slice(0, at), ...filtered, ...state.tracks.slice(at)]
      const currentIndex =
        state.currentIndex >= at ? state.currentIndex + filtered.length : state.currentIndex
      return { tracks, currentIndex }
    }

    case 'playNow': {
      const existing = state.tracks.findIndex((track) => track.id === action.track.id)
      return existing === -1
        ? { tracks: [action.track, ...state.tracks], currentIndex: 0 }
        : { ...state, currentIndex: existing }
    }

    case 'playAll': {
      const ids = new Set<string>()
      const tracks = action.tracks.filter((track) => {
        if (ids.has(track.id)) return false
        ids.add(track.id)
        return true
      })
      return tracks.length === 0 ? initialQueueState : { tracks, currentIndex: 0 }
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
      if (tracks.length === 0) currentIndex = -1
      else if (action.index < currentIndex) currentIndex -= 1
      else if (action.index === currentIndex) currentIndex = clampIndex(tracks, currentIndex)
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
      const tracks = [...state.tracks]
      const [moved] = tracks.splice(action.from, 1)
      tracks.splice(action.to, 0, moved)
      const currentId = state.tracks[state.currentIndex]?.id
      const currentIndex = currentId ? tracks.findIndex((track) => track.id === currentId) : -1
      return { tracks, currentIndex }
    }

    case 'clear':
      return initialQueueState
  }
}

export const mergeHydratedQueue = (
  stored: Readonly<PersistedQueueType>,
  pending: ReadonlyArray<QueueAction>
): PersistedQueueType => pending.reduce(reduceQueue, stored)
