import { Option, Schema, Stream } from 'effect'
import { Subscription } from 'foldkit'

export const SheetDrag = Schema.NullOr(
  Schema.Struct({ pointerId: Schema.Number, startY: Schema.Number }),
)

export type SheetDrag = typeof SheetDrag.Type

export const startDrag = (pointerId: number, clientY: number, offset: number): SheetDrag => ({
  pointerId,
  startY: clientY - offset,
})

export const dragOffset = (drag: NonNullable<SheetDrag>, clientY: number) =>
  Math.max(0, clientY - drag.startY)

export const shouldDismiss = (offset: number, viewportHeight: number) =>
  offset >= Math.min(160, viewportHeight * 0.2)

export const onDragStart =
  <Message>(
    toMessage: (pointer: { pointerId: number; clientY: number }) => Message,
    allowControls = false,
  ) =>
  (
    _pointerType: string,
    button: number,
    _screenX: number,
    _screenY: number,
    _timeStamp: number,
    _clientX: number,
    clientY: number,
    pointerId: number,
    target: EventTarget | null,
  ): Option.Option<Message> =>
    button !== 0 ||
    (!allowControls && target instanceof Element && target.closest('button, a, input'))
      ? Option.none()
      : Option.some(toMessage({ pointerId, clientY }))

export const dragEvents = <Message>(messages: {
  readonly moved: (pointer: { pointerId: number; clientY: number }) => Message
  readonly released: (pointer: {
    pointerId: number
    clientY: number
    viewportHeight: number
  }) => Message
  readonly cancelled: () => Message
}) =>
  Stream.mergeAll<Message, never, never>(
    [
      Subscription.fromEvent({
        target: document,
        type: 'pointermove',
        mapEvent: (event) => messages.moved({ pointerId: event.pointerId, clientY: event.clientY }),
      }),
      Subscription.fromEvent({
        target: document,
        type: 'pointerup',
        mapEvent: (event) =>
          messages.released({
            pointerId: event.pointerId,
            clientY: event.clientY,
            viewportHeight: window.innerHeight,
          }),
      }),
      Subscription.fromEvent({
        target: document,
        type: 'pointercancel',
        mapEvent: () => messages.cancelled(),
      }),
      Subscription.fromEvent({
        target: window,
        type: 'blur',
        mapEvent: () => messages.cancelled(),
      }),
    ],
    { concurrency: 'unbounded' },
  )
