export {
  AudioStorageError,
  PersistedQueue,
  parsePersistedQueue,
  QueueTrack,
  type PersistedQueueType,
  type QueueTrackType
} from './persistedQueue'

export { initialQueueState, mergeHydratedQueue, reduceQueue, type QueueAction } from './queueState'

export {
  shouldPersistPosition,
  transitionPlaybackIntent,
  transitionSourceCompletion,
  transitionSourcePreparation,
  type PlaybackIntent,
  type PlaybackIntentEvent,
  type SourceCompletion,
  type SourcePreparation,
  type SourcePreparationEvent
} from './playbackState'

export {
  createAudioStorage,
  createWebAudioStorageAdapter,
  DEDUP_WINDOW_MS,
  type AudioStorageAdapter,
  type PositionRecordType
} from './audioStorage'

export { createPlayDelivery } from './playDelivery'

export type { AudioEngine, EngineStatus, NowPlayingMetadata } from './engine'

export {
  clearPosition,
  isWithinDedupWindow,
  layerFromAdapter,
  loadPosition,
  loadQueue,
  PlayerStorage,
  PlayerStorageInMemory,
  PlayerStorageTest,
  providePlayerStorage,
  recordPlay,
  savePosition,
  saveQueue,
  type PlayerStorageShape,
  type PositionRecord
} from './playerStorage'

export {
  createPlayerCore,
  type PlayerCore,
  type PlayerCoreCallbacks,
  type PlayerCoreStorage
} from './playerCore'

export {
  makeQueueAtom,
  selectQueueView,
  type InternalQueueAction,
  type QueueAtomHandle,
  type QueueAtomStorage,
  type QueueView
} from './queueAtom'
