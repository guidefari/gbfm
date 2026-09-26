import { Schema } from 'effect'
import { HttpApiEndpoint, HttpApiError, HttpApiGroup } from 'effect/unstable/httpapi'

export const Slug = Schema.String.pipe(Schema.brand('MicroPostSlug'))

export type Slug = typeof Slug.Type

const SlugParam = { slug: Schema.String }

export const MicroPostTimelineMonth = Schema.Struct({
  month: Schema.String,
  total: Schema.Number,
  unread: Schema.Number,
  newestSlug: Slug,
})

export type MicroPostTimelineMonth = typeof MicroPostTimelineMonth.Type

export const MicroPostNeighboursResponse = Schema.Struct({
  newer: Schema.NullOr(Slug),
  older: Schema.NullOr(Slug),
  olderUnread: Schema.NullOr(Slug),
  seen: Schema.Boolean,
  unreadCount: Schema.Number,
  timeline: Schema.Array(MicroPostTimelineMonth),
})

export type MicroPostNeighboursResponse = typeof MicroPostNeighboursResponse.Type

export const MicroPostRandomUnreadResponse = Schema.Struct({ slug: Slug })

export type MicroPostRandomUnreadResponse = typeof MicroPostRandomUnreadResponse.Type

export const MicroPostSeenResponse = Schema.Struct({ recorded: Schema.Boolean })

export type MicroPostSeenResponse = typeof MicroPostSeenResponse.Type

export const NavigationGroup = HttpApiGroup.make('navigation')
  .add(
    HttpApiEndpoint.get('getMicroPostNeighbours', '/api/content/posts/micro/:slug/neighbours', {
      params: SlugParam,
      success: MicroPostNeighboursResponse,
      error: [HttpApiError.NotFound, HttpApiError.InternalServerError],
    }),
  )
  .add(
    HttpApiEndpoint.get('getRandomUnreadMicroPost', '/api/content/posts/micro/:slug/random', {
      params: SlugParam,
      success: MicroPostRandomUnreadResponse,
      error: [HttpApiError.NotFound, HttpApiError.InternalServerError],
    }),
  )
  .add(
    HttpApiEndpoint.post('markMicroPostSeen', '/api/content/posts/micro/:slug/seen', {
      params: SlugParam,
      success: MicroPostSeenResponse,
      error: [HttpApiError.NotFound, HttpApiError.InternalServerError],
    }),
  )
