import { Option, Stream } from 'effect'
import { Dom } from 'foldkit'

export const authFormAttribute = 'auth-form'

export const authSubmitEvents = <Message>(messages: {
  readonly submitted: () => Message
  readonly restored: () => Message
}) =>
  Stream.merge(
    Dom.streamFromEventFilterMap({
      target: document,
      type: 'submit',
      filterMapEvent: (event) =>
        event.target instanceof HTMLFormElement && 'authForm' in event.target.dataset
          ? Option.some(messages.submitted())
          : Option.none(),
    }),
    Dom.streamFromEventFilterMap({
      target: window,
      type: 'pageshow',
      filterMapEvent: (event) =>
        event.persisted ? Option.some(messages.restored()) : Option.none(),
    }),
  )
