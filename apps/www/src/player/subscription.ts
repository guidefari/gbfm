import { Effect, Queue, Schema, Stream } from 'effect'
import { Subscription } from 'foldkit'

import { dragEvents } from '../sheet-drag'
import { Message, type Model } from './model'
import { PlayerClient } from './runtime'

const snapshots = Stream.unwrap(
  PlayerClient.pipe(
    Effect.map(({ controller }) =>
      Stream.callback<typeof Message.SnapshotChanged.Type>((queue) =>
        Effect.acquireRelease(
          Effect.sync(() =>
            controller.subscribeSnapshot((snapshot) =>
              Queue.offerUnsafe(queue, Message.SnapshotChanged({ snapshot })),
            ),
          ),
          (unsubscribe) => Effect.sync(unsubscribe),
        ),
      ),
    ),
  ),
)

/** Persistent playback events. Lift this record into the parent alongside the submodel. */
export const subscriptions = Subscription.make<Model, typeof Message.Type, PlayerClient>()(
  (entry) => ({
    playerSnapshots: Subscription.persistentEntry(snapshots),
    playerDrag: entry(
      { isDragging: Schema.Boolean },
      {
        modelToDependencies: (model) => ({ isDragging: model.playerDrag !== null }),
        dependenciesToStream: ({ isDragging }) =>
          isDragging
            ? dragEvents<typeof Message.Type>({
                moved: Message.PlayerDragMoved,
                released: Message.PlayerDragReleased,
                cancelled: Message.PlayerDragCancelled,
              })
            : Stream.empty,
      },
    ),
  }),
)
