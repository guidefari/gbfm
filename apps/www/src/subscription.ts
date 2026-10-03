import { Subscription } from 'foldkit'

import { Message } from './message'
import type { Model } from './model'
import * as Creator from './page/creator'
import * as Player from './player'
import * as Search from './search'

export const subscriptions = Subscription.aggregate(
  Subscription.lift(Search.subscriptions)<Model, Message>({
    toChildModel: (model) => model.search,
    toParentMessage: (message) => Message.GotSearchMessage({ message }),
  }),
  Subscription.lift(Player.subscriptions)<Model, Message>({
    toChildModel: (model) => model.player,
    toParentMessage: (message) => Message.GotPlayerMessage({ message }),
  }),
  Subscription.lift(Creator.subscriptions)<Model, Message>({
    toChildModel: (model) => model.creator,
    toParentMessage: (message) => Message.GotCreatorMessage({ message }),
  }),
)
