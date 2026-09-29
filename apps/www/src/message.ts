import { MicroPostScreenRepliesResponse } from '@gbfm/api/post'
import { Schema } from 'effect'
import { defineMessageUnion } from 'foldkit/message'
import { UrlRequest } from 'foldkit/navigation'
import { Url } from 'foldkit/url'

import * as Creator from './creator'
import * as Dashboard from './dashboard'
import { Flags } from './model'
import * as Player from './player'
import * as PublicActions from './public-actions'
import * as Search from './search'

export const Message = defineMessageUnion({
  ClientStarted: {},
  MenuToggled: {},
  GotSearchMessage: { message: Search.Message },
  GotPublicActionMessage: { message: PublicActions.Message },
  SkipSeenChanged: { value: Schema.Boolean },
  ReadModeFailed: {},
  GotPlayerMessage: { message: Player.Message },
  GotCreatorMessage: { message: Creator.Message },
  GotCreatorResult: { message: Creator.Message, navigationId: Schema.Number },
  GotDashboardMessage: { message: Dashboard.Message },
  GotDashboardResult: { message: Dashboard.Message, navigationId: Schema.Number },
  RequestedUrl: { request: UrlRequest },
  ChangedUrl: { url: Url },
  LoadedPage: { flags: Flags, key: Schema.String, navigationId: Schema.Number },
  FailedPage: { key: Schema.String, navigationId: Schema.Number },
  LoadedReplies: { slug: Schema.String, replies: MicroPostScreenRepliesResponse },
  FailedReplies: { slug: Schema.String },
  NavigationCompleted: {},
  PrefetchedPage: { flags: Flags, key: Schema.String },
  PrefetchRequested: { href: Schema.String },
})

export type Message = typeof Message.Type
