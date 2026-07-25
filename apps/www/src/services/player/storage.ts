import { createAudioStorage, createWebAudioStorageAdapter } from '@gbfm/player'

const adapter = createWebAudioStorageAdapter(() =>
  typeof window === 'undefined' ? undefined : window.localStorage
)

export const {
  clearPosition,
  isWithinDedupWindow,
  loadPlay,
  loadPosition,
  loadQueue,
  recordPlay,
  savePosition,
  saveQueue
} = createAudioStorage(adapter)
