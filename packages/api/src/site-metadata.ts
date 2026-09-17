import { Schema } from 'effect'
import { HttpApiEndpoint, HttpApiError, HttpApiGroup } from 'effect/unstable/httpapi'
import { SiteMetadata } from '@gbfm/site-metadata'

/** Public route families resolved by the server metadata projection. */
export const SiteMetadataRouteKind = Schema.Literals([
  'mix',
  'track',
  'show',
  'release',
  'label',
  'profile',
  'editorial',
  'tweet',
  'post',
  'slug'
])

export type SiteMetadataRouteKind = typeof SiteMetadataRouteKind.Type

export const SiteMetadataGroup = HttpApiGroup.make('siteMetadata').add(
  HttpApiEndpoint.get('getSiteMetadata', '/api/site-metadata/:kind/:slug', {
    params: {
      kind: SiteMetadataRouteKind,
      slug: Schema.String
    },
    success: SiteMetadata,
    error: HttpApiError.NotFound
  })
)
