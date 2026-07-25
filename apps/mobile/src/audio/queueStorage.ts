import { File, Paths } from 'expo-file-system'
import { Platform } from 'react-native'
import {
  createAudioStorage,
  createWebAudioStorageAdapter,
  type AudioStorageAdapter
} from '@gbfm/player'

export * from '@gbfm/player'

const nativeAudioStorageAdapter: AudioStorageAdapter = {
  read: async (key) => {
    const file = new File(Paths.document, key)
    return file.exists ? file.text() : null
  },
  write: (key, value) => {
    new File(Paths.document, key).write(value)
    return Promise.resolve()
  },
  remove: (key) => {
    const file = new File(Paths.document, key)
    if (file.exists) file.delete()
    return Promise.resolve()
  }
}

const adapter =
  Platform.OS === 'web'
    ? createWebAudioStorageAdapter(() => globalThis.localStorage)
    : nativeAudioStorageAdapter

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
