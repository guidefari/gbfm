import type { UrlRequest } from 'foldkit/navigation'
import type { Url } from 'foldkit/url'

import { Message } from './application/message'
import { ContentItem, Flags, Model, Principal } from './application/model'
import { parseRoute, Route } from './application/route'
import { clientResources, displayedPath, init, subscriptions, update } from './application/update'
import { view } from './application/view'

export {
  ContentItem,
  Flags,
  Message,
  Model,
  parseRoute,
  Principal,
  Route,
  clientResources,
  displayedPath,
  init,
  subscriptions,
  update,
  view,
}

export const applicationConfig = {
  Flags,
  Model,
  init,
  update,
  view,
  routing: {
    onUrlRequest: (request: UrlRequest) => Message.RequestedUrl({ request }),
    onUrlChange: (url: Url) => Message.ChangedUrl({ url }),
  },
}
