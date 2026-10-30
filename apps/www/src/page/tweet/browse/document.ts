import { MicroPostTimelineMonth } from '@gbfm/api/navigation'
import { GetMicroPostListResponse } from '@gbfm/api/post'
import { Schema } from 'effect'

export const TweetBrowseDocument = Schema.Struct({
  posts: GetMicroPostListResponse.fields.data,
  timeline: Schema.Array(MicroPostTimelineMonth),
  month: Schema.NullOr(Schema.String),
  page: Schema.Number,
  total: Schema.Number,
  hasMore: Schema.Boolean,
  datesAvailable: Schema.Boolean,
  selected: Schema.NullOr(Schema.String),
  failure: Schema.NullOr(Schema.String),
})

export type TweetBrowseDocument = typeof TweetBrowseDocument.Type
