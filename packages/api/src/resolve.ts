import { Schema } from 'effect'
import { HttpApiEndpoint, HttpApiError, HttpApiGroup } from 'effect/unstable/httpapi'
import { PublicProfileResponse } from './profile'

const ShowHost = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  username: Schema.NullOr(Schema.String)
})

const ResolvedShowData = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  slug: Schema.String,
  description: Schema.NullOr(Schema.String),
  thumbnailUrl: Schema.NullOr(Schema.String),
  bannerImageUrl: Schema.NullOr(Schema.String),
  tags: Schema.NullOr(Schema.Array(Schema.String)),
  createdAt: Schema.String,
  compiledContent: Schema.NullOr(Schema.String),
  hosts: Schema.Array(ShowHost)
})

const ResolvedProfile = Schema.Struct({
  type: Schema.Literal('profile'),
  data: PublicProfileResponse
})

const ResolvedShow = Schema.Struct({
  type: Schema.Literal('show'),
  data: ResolvedShowData
})

export const ResolveResult = Schema.Union([ResolvedProfile, ResolvedShow])
export type ResolveResult = typeof ResolveResult.Type

export const ResolveGroup = HttpApiGroup.make('resolve').add(
  HttpApiEndpoint.get('resolveSlug', '/api/resolve/:slug', {
    params: { slug: Schema.String },
    success: ResolveResult,
    error: HttpApiError.NotFound
  })
)
