import type { QueueTrackType } from '@gbfm/player'
import { makeQueueAtom, selectQueueView, type QueueAction, type QueueView } from '@gbfm/player'
import { useAtomSet, useAtomValue } from '@effect/atom-react'
import { Effect, Schema } from 'effect'
import * as Atom from 'effect/unstable/reactivity/Atom'
import { queuePersistence } from '@/runtime'
import { log } from '@/services/logger'
import { activeQueueTrack, isActivePreview, noneSource, type ActiveSource } from './activeSource'
import { readStoredFullscreenVisibility } from './visibilityStorage'

export type { QueueAction, QueueTrackType, QueueView, ActiveSource }

const { queueAtom } = makeQueueAtom({
  loadQueue: queuePersistence.loadQueue,
  saveQueue: queuePersistence.saveQueue,
  onError: (message, error) => log('error', message, { error })
})

export { queueAtom }

export const useQueue = (): QueueView => useAtomValue(queueAtom, selectQueueView)

export const useQueueDispatch = (): ((action: QueueAction) => void) => useAtomSet(queueAtom)

export type TransportState = {
  readonly isPlaying: boolean
  readonly currentTime: number
  readonly duration: number
  readonly isInitialized: boolean
}

export const initialTransportState: TransportState = {
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  isInitialized: false
}

export const transportAtom = Atom.make<TransportState>(initialTransportState).pipe(Atom.keepAlive)

export type VolumeState = {
  readonly volume: number
  readonly isMuted: boolean
}

const VOLUME_KEY = 'gbfm-audio-volume.json'

const defaultVolume: VolumeState = { volume: 100, isMuted: false }

const StoredVolume = Schema.Struct({
  volume: Schema.Number,
  isMuted: Schema.Boolean
})

export const readStoredVolume = (): VolumeState => {
  if (typeof window === 'undefined') return defaultVolume
  const raw = window.localStorage.getItem(VOLUME_KEY)
  if (!raw) return defaultVolume

  return Effect.runSync(
    Effect.try({ try: (): unknown => JSON.parse(raw), catch: () => null }).pipe(
      Effect.flatMap(Schema.decodeUnknownEffect(StoredVolume)),
      Effect.map((stored) => ({
        volume: Math.max(0, Math.min(100, stored.volume)),
        isMuted: stored.isMuted
      })),
      Effect.catch(() => Effect.succeed(defaultVolume))
    )
  )
}

export const volumeAtom = Atom.make<VolumeState>(readStoredVolume()).pipe(Atom.keepAlive)

export const persistVolume = (state: VolumeState) => {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(VOLUME_KEY, JSON.stringify(state))
  } catch {}
}

/** Which source is audibly driving the shared element: queue, preview, or none. */
export const activeSourceAtom = Atom.make<ActiveSource>(noneSource).pipe(Atom.keepAlive)

export const useActiveSource = () => useAtomValue(activeSourceAtom)

/** Preview URL when a non-queue source is active; null otherwise. */
export const usePreviewSrc = () =>
  useAtomValue(activeSourceAtom, (source) => (source._tag === 'preview' ? source.src : null))

export type VisibilityState = {
  readonly isQueueVisible: boolean
  readonly isFullscreenVisible: boolean
}

export const visibilityAtom = Atom.make<VisibilityState>({
  isQueueVisible: false,
  isFullscreenVisible: readStoredFullscreenVisibility()
}).pipe(Atom.keepAlive)

export const useTransport = () => useAtomValue(transportAtom)
export const useSetTransport = () => useAtomSet(transportAtom)
export const useVolume = () => useAtomValue(volumeAtom)
export const useSetVolume = () => useAtomSet(volumeAtom)
export const useVisibility = () => useAtomValue(visibilityAtom)
export const useSetVisibility = () => useAtomSet(visibilityAtom)

/** Queue track currently selected in the queue atom (may survive a preview). */
export const useSelectedQueueTrack = (): QueueTrackType | null =>
  useAtomValue(queueAtom, (state) =>
    state.currentIndex >= 0 ? (state.tracks[state.currentIndex] ?? null) : null
  )

/** Track the UI should treat as now-playing. Null while a preview is active so
 *  chrome does not claim a silent queue selection is audible. */
export const useNowPlayingTrack = (): QueueTrackType | null =>
  useAtomValue(activeSourceAtom, activeQueueTrack)

export const useIsActivePreview = (src: string): boolean =>
  useAtomValue(activeSourceAtom, (source) => isActivePreview(source, src))

export const useProgress = () =>
  useAtomValue(transportAtom, (state) => ({
    currentTime: state.currentTime,
    duration: state.duration,
    progress: state.duration > 0 ? (state.currentTime / state.duration) * 100 : 0
  }))
