import {
  initialQueueState,
  makeQueueAtom,
  mergeHydratedQueue,
  reduceQueue,
  type QueueAction,
  type QueueView
} from '@gbfm/player'
import { useAtomSet, useAtomValue } from '@effect/atom-react'
import { loadQueue, saveQueue } from '@/audio/queueStorage'

export { initialQueueState, mergeHydratedQueue, reduceQueue, type QueueAction, type QueueView }

const { queueAtom, selectQueueView } = makeQueueAtom({ loadQueue, saveQueue })

export { queueAtom }

export const useQueue = (): QueueView => useAtomValue(queueAtom, selectQueueView)

export const useQueueDispatch = (): ((action: QueueAction) => void) => useAtomSet(queueAtom)
