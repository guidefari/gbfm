import { Option, Schema, Stream } from 'effect'
import { Subscription } from 'foldkit'

import { authSubmitEvents } from './auth-submit'
import { Message } from './message'
import type { Model } from './model'
import * as Creator from './page/creator'
import * as Player from './player'
import * as Search from './search'
import { dragEvents } from './sheet-drag'

const menuSubscriptions = Subscription.make<Model, Message>()((entry) => ({
  menuDrag: entry(
    { isDragging: Schema.Boolean },
    {
      modelToDependencies: (model) => ({ isDragging: model.menuDrag !== null }),
      dependenciesToStream: ({ isDragging }) =>
        isDragging
          ? dragEvents<Message>({
              moved: Message.MenuDragMoved,
              released: Message.MenuDragReleased,
              cancelled: Message.MenuDragCancelled,
            })
          : Stream.empty,
    },
  ),
}))

const authSubscriptions = Subscription.make<Model, Message>()((entry) => ({
  authSubmit: entry(
    { interactive: Schema.Boolean },
    {
      modelToDependencies: (model) => ({ interactive: model.interactive }),
      dependenciesToStream: ({ interactive }) =>
        interactive
          ? authSubmitEvents<Message>({
              submitted: Message.AuthFormSubmitted,
              restored: Message.AuthFormRestored,
            })
          : Stream.empty,
    },
  ),
}))

export const subscriptions = Subscription.aggregate(
  menuSubscriptions,
  authSubscriptions,
  Subscription.lift(Search.subscriptions)<Model, Message>({
    read: (model) => Option.some(model.search),
    toParentMessage: (message) => Message.GotSearchMessage({ message }),
  }),
  Subscription.lift(Player.subscriptions)<Model, Message>({
    read: (model) => Option.some(model.player),
    toParentMessage: (message) => Message.GotPlayerMessage({ message }),
  }),
  Subscription.lift(Creator.subscriptions)<Model, Message>({
    read: (model) => Option.some(model.creator),
    toParentMessage: (message) => Message.GotCreatorMessage({ message }),
  }),
)
