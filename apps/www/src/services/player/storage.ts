import { createWebAudioStorageAdapter, layerFromAdapter } from '@gbfm/player'

const adapter = createWebAudioStorageAdapter(() =>
  typeof window === 'undefined' ? undefined : window.localStorage
)

export const PlayerStorageLive = layerFromAdapter(adapter)
