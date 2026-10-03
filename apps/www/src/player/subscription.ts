import { Effect, Queue, Schema, Stream } from 'effect'
import { Subscription } from 'foldkit'

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
    playerSnapshots: Subscription.persistent(snapshots),
    playerDrag: entry(
      { isDragging: Schema.Boolean },
      {
        modelToDependencies: (model) => ({ isDragging: model.playerDrag !== null }),
        dependenciesToStream: ({ isDragging }) =>
          isDragging
            ? Stream.mergeAll<typeof Message.Type, never, never>(
                [
                  Subscription.fromEvent({
                    target: document,
                    type: 'pointermove',
                    mapEvent: (event) =>
                      Message.PlayerDragMoved({
                        pointerId: event.pointerId,
                        clientY: event.clientY,
                      }),
                  }),
                  Subscription.fromEvent({
                    target: document,
                    type: 'pointerup',
                    mapEvent: (event) =>
                      Message.PlayerDragReleased({
                        pointerId: event.pointerId,
                        clientY: event.clientY,
                        viewportHeight: window.innerHeight,
                      }),
                  }),
                  Subscription.fromEvent({
                    target: document,
                    type: 'pointercancel',
                    mapEvent: () => Message.PlayerDragCancelled(),
                  }),
                  Subscription.fromEvent({
                    target: window,
                    type: 'blur',
                    mapEvent: () => Message.PlayerDragCancelled(),
                  }),
                ],
                { concurrency: 'unbounded' },
              )
            : Stream.empty,
      },
    ),
  }),
)
