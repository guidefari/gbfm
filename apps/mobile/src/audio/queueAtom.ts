import {
  initialQueueState,
  makeQueueAtom,
  mergeHydratedQueue,
  reduceQueue,
  type QueueAction,
  type QueueView
} from '@gbfm/player'
import { useAtomSet, useAtomValue } from '@effect/atom-react'
import { playerStorage } from '@/runtime'

export { initialQueueState, mergeHydratedQueue, reduceQueue, type QueueAction, type QueueView }

const { queueAtom, selectQueueView } = makeQueueAtom({
  loadQueue: playerStorage.loadQueue,
  saveQueue: playerStorage.saveQueue
})

export { queueAtom }

export const useQueue = (): QueueView => useAtomValue(queueAtom, selectQueueView)

export const useQueueDispatch = (): ((action: QueueAction) => void) => useAtomSet(queueAtom)
