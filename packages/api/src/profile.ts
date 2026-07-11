import { Schema } from 'effect'
import { HttpApiEndpoint, HttpApiError, HttpApiGroup } from 'effect/unstable/httpapi'

const SOCIAL_LINK_PLATFORMS = [
  'bandcamp',
  'substack',
  'soundcloud',
  'instagram',
  'twitter',
  'tiktok'
] as const

const SocialLink = Schema.Struct({
  platform: Schema.Literals(SOCIAL_LINK_PLATFORMS),
  url: Schema.String,
  position: Schema.Number
})

const MixSummary = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  slug: Schema.String,
  thumbnailUrl: Schema.NullOr(Schema.String),
  type: Schema.Literals(['mix', 'track', 'misc']),
  showId: Schema.NullOr(Schema.String)
})

const ShowSummary = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  slug: Schema.String,
  thumbnailUrl: Schema.NullOr(Schema.String)
})

const EditorialSummary = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  slug: Schema.String,
  thumbnailUrl: Schema.NullOr(Schema.String),
  description: Schema.NullOr(Schema.String),
  createdAt: Schema.String
})

const TweetSummary = Schema.Struct({
  id: Schema.String,
  title: Schema.NullOr(Schema.String),
  slug: Schema.String,
  createdAt: Schema.String
})

export const PublicProfileResponse = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  username: Schema.NullOr(Schema.String),
  image: Schema.NullOr(Schema.String),
  bio: Schema.NullOr(Schema.String),
  socialLinks: Schema.Array(SocialLink),
  createdAt: Schema.String,
  content: Schema.Struct({
    mixes: Schema.Array(MixSummary),
    shows: Schema.Array(ShowSummary),
    editorials: Schema.Array(EditorialSummary),
    tweets: Schema.Array(TweetSummary)
  })
})
export type PublicProfileResponse = typeof PublicProfileResponse.Type

export const ProfileGroup = HttpApiGroup.make('profile').add(
  HttpApiEndpoint.get('getPublicProfile', '/api/profile/:username', {
    params: { username: Schema.String },
    success: PublicProfileResponse,
    error: HttpApiError.NotFound
  })
)
