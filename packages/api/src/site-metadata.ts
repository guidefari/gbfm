import { Schema } from 'effect'
import { HttpApiEndpoint, HttpApiError, HttpApiGroup } from 'effect/unstable/httpapi'
import { SocialCardKind, SocialCardPresentation } from '@gbfm/social-card'
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

export const SiteMetadataGroup = HttpApiGroup.make('siteMetadata')
  .add(
    HttpApiEndpoint.get('getSiteMetadata', '/api/site-metadata/:kind/:slug', {
      params: {
        kind: SiteMetadataRouteKind,
        slug: Schema.String
      },
      success: SiteMetadata,
      error: HttpApiError.NotFound
    })
  )
  .add(
    HttpApiEndpoint.get('getSocialCard', '/api/social-cards/:kind/:slug', {
      params: {
        kind: SocialCardKind,
        slug: Schema.String
      },
      success: SocialCardPresentation,
      error: HttpApiError.NotFound
    })
  )
