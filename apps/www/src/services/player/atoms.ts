import type { QueueTrackType } from '@gbfm/player'
import type {
  PlaybackSnapshot,
  PlaybackTransportSnapshot,
  QueueView,
  VolumeRecordType
} from '@gbfm/player'
import { useAtomSet, useAtomValue } from '@effect/atom-react'
import * as Atom from 'effect/unstable/reactivity/Atom'
import { Effect, Schema } from 'effect'
import { readStoredFullscreenVisibility } from './visibilityStorage'

export type {
  QueueTrackType,
  QueueView,
  PlaybackSnapshot,
  PlaybackTransportSnapshot,
  VolumeRecordType
}

const initialQueue: QueueView = { tracks: [], currentIndex: -1, current: null }
const initialTransport: PlaybackTransportSnapshot = {
  isInitialized: false,
  isLoaded: false,
  isPlaying: false,
  isBuffering: false,
  currentTime: 0,
  duration: 0
}
const initialVolume: VolumeRecordType = { volume: 100, isMuted: false }

export const initialPlaybackSnapshot: PlaybackSnapshot = {
  queue: initialQueue,
  transport: initialTransport,
  volume: initialVolume
}

export const playbackAtom = Atom.make<PlaybackSnapshot>(initialPlaybackSnapshot).pipe(
  Atom.keepAlive
)

export const usePlaybackSnapshot = (): PlaybackSnapshot => useAtomValue(playbackAtom)

export const useQueue = (): QueueView => useAtomValue(playbackAtom, (state) => state.queue)

export const useQueueDispatch = (): ((snapshot: PlaybackSnapshot) => void) =>
  useAtomSet(playbackAtom)

export type TransportState = PlaybackTransportSnapshot
export const useTransport = () => useAtomValue(playbackAtom, (state) => state.transport)
export const useSetTransport = () => useAtomSet(playbackAtom)

export type VolumeState = VolumeRecordType
export const useVolume = () => useAtomValue(playbackAtom, (state) => state.volume)
export const useSetVolume = () => useAtomSet(playbackAtom)

export type VisibilityState = {
  readonly isQueueVisible: boolean
  readonly isFullscreenVisible: boolean
}

const VISIBILITY_KEY = 'gbfm-player-visibility.json'

const defaultVisibility: VisibilityState = {
  isQueueVisible: false,
  isFullscreenVisible: readStoredFullscreenVisibility()
}

const StoredVisibility = Schema.Struct({
  isQueueVisible: Schema.Boolean,
  isFullscreenVisible: Schema.Boolean
})

export const readStoredVisibility = (): VisibilityState => {
  if (!('window' in globalThis)) return defaultVisibility
  const raw = window.localStorage.getItem(VISIBILITY_KEY)
  if (!raw) return defaultVisibility

  return Effect.runSync(
    Effect.try({ try: (): unknown => JSON.parse(raw), catch: () => null }).pipe(
      Effect.flatMap(Schema.decodeUnknownEffect(StoredVisibility)),
      Effect.catch(() => Effect.succeed(defaultVisibility))
    )
  )
}

export const persistVisibility = (_state: VisibilityState) => {
  if (!('window' in globalThis)) return
}

export const visibilityAtom = Atom.make<VisibilityState>(defaultVisibility).pipe(Atom.keepAlive)
export const useVisibility = () => useAtomValue(visibilityAtom)
export const useSetVisibility = () => useAtomSet(visibilityAtom)

export const useSelectedQueueTrack = (): QueueTrackType | null =>
  useAtomValue(playbackAtom, (state) => state.queue.current)

export const useNowPlayingTrack = (): QueueTrackType | null =>
  useAtomValue(playbackAtom, (state) => state.queue.current)

export const useProgress = () =>
  useAtomValue(playbackAtom, (state) => ({
    currentTime: state.transport.currentTime,
    duration: state.transport.duration,
    progress:
      state.transport.duration > 0
        ? (state.transport.currentTime / state.transport.duration) * 100
        : 0
  }))
