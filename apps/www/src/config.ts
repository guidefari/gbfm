import type { UrlRequest } from 'foldkit/navigation'
import type { Url } from 'foldkit/url'

import { init } from './init'
import { Message } from './message'
import { Flags, Model } from './model'
import { update } from './update'
import { view } from './view'

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
