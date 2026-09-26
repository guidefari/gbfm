import { Api } from '@gbfm/api/api'
import { Effect } from 'effect'
import { HttpApiBuilder, HttpApiError } from 'effect/unstable/httpapi'

import { dieOnDatabaseError as makeDieOnDatabaseError } from '@/http/handler-utils'
import {
  resolveSiteMetadata,
  resolveSocialCardPresentation,
} from '@/services/site-presentation.service'

const dieOnDatabaseError = makeDieOnDatabaseError('site-metadata')

export const SiteMetadataHandlersLive = HttpApiBuilder.group(Api, 'siteMetadata', (handlers) =>
  handlers
    .handle('getSiteMetadata', ({ params }) =>
      dieOnDatabaseError(
        resolveSiteMetadata(params.kind, params.slug).pipe(
          Effect.catchTag('NotFoundError', () => new HttpApiError.NotFound()),
        ),
      ),
    )
    .handle('getSocialCard', ({ params }) =>
      dieOnDatabaseError(
        resolveSocialCardPresentation(params.kind, params.slug).pipe(
          Effect.catchTag('NotFoundError', () => new HttpApiError.NotFound()),
        ),
      ),
    ),
)
