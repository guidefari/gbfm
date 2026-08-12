import { createWebAudioStorageAdapter, layerFromAdapter } from '@gbfm/player'

const adapter = createWebAudioStorageAdapter(() =>
  'window' in globalThis ? window.localStorage : undefined
)

export const PlayerStorageLive = layerFromAdapter(adapter)
