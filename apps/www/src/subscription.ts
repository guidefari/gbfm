import { Subscription } from 'foldkit'

import * as Creator from './creator'
import { Message } from './message'
import type { Model } from './model'
import * as Player from './player'

export const subscriptions = Subscription.aggregate(
  Subscription.lift(Player.subscriptions)<Model, Message>({
    toChildModel: (model) => model.player,
    toParentMessage: (message) => Message.GotPlayerMessage({ message }),
  }),
  Subscription.lift(Creator.subscriptions)<Model, Message>({
    toChildModel: (model) => model.creator,
    toParentMessage: (message) => Message.GotCreatorMessage({ message }),
  }),
)
