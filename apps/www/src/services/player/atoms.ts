import type { QueueTrackType } from '@gbfm/player'
import { makeQueueAtom, selectQueueView, type QueueAction, type QueueView } from '@gbfm/player'
import { useAtomSet, useAtomValue } from '@effect/atom-react'
import * as Atom from 'effect/unstable/reactivity/Atom'
import { log } from '@/services/logger'
import { loadQueue, saveQueue } from './storage'

export type { QueueAction, QueueTrackType, QueueView }

const { queueAtom } = makeQueueAtom({
  loadQueue,
  saveQueue,
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

const readStoredVolume = (): VolumeState => {
  if (typeof window === 'undefined') return { volume: 100, isMuted: false }
  try {
    const raw = window.localStorage.getItem(VOLUME_KEY)
    if (!raw) return { volume: 100, isMuted: false }
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return { volume: 100, isMuted: false }
    const { volume, isMuted } = parsed as Partial<VolumeState>
    return {
      volume: typeof volume === 'number' && volume >= 0 && volume <= 100 ? volume : 100,
      isMuted: typeof isMuted === 'boolean' ? isMuted : false
    }
  } catch {
    return { volume: 100, isMuted: false }
  }
}

export const volumeAtom = Atom.make<VolumeState>(readStoredVolume()).pipe(Atom.keepAlive)

export const persistVolume = (state: VolumeState) => {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(VOLUME_KEY, JSON.stringify(state))
  } catch {}
}

export type VisibilityState = {
  readonly isQueueVisible: boolean
  readonly isFullscreenVisible: boolean
}

export const visibilityAtom = Atom.make<VisibilityState>({
  isQueueVisible: false,
  isFullscreenVisible: false
}).pipe(Atom.keepAlive)

export const useTransport = () => useAtomValue(transportAtom)
export const useSetTransport = () => useAtomSet(transportAtom)
export const useVolume = () => useAtomValue(volumeAtom)
export const useSetVolume = () => useAtomSet(volumeAtom)
export const useVisibility = () => useAtomValue(visibilityAtom)
export const useSetVisibility = () => useAtomSet(visibilityAtom)

export const useNowPlayingTrack = (): QueueTrackType | null =>
  useAtomValue(queueAtom, (state) =>
    state.currentIndex >= 0 ? (state.tracks[state.currentIndex] ?? null) : null
  )

export const useProgress = () =>
  useAtomValue(transportAtom, (state) => ({
    currentTime: state.currentTime,
    duration: state.duration,
    progress: state.duration > 0 ? (state.currentTime / state.duration) * 100 : 0
  }))
