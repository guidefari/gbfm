import { Effect, Schema } from 'effect'
import { HttpApiEndpoint, HttpApiGroup } from 'effect/unstable/httpapi'

export const SearchResultItem = Schema.Struct({
  id: Schema.String,
  title: Schema.NullOr(Schema.String),
  slug: Schema.String,
  type: Schema.String,
  thumbnailUrl: Schema.NullOr(Schema.String),
  description: Schema.NullOr(Schema.String)
})
export type SearchResultItem = typeof SearchResultItem.Type

export const SearchResults = Schema.Struct({
  shows: Schema.Array(SearchResultItem),
  audio: Schema.Array(SearchResultItem),
  posts: Schema.Array(SearchResultItem)
})
export type SearchResults = typeof SearchResults.Type

// Query validation failures (e.g. missing `q`) decode to 400 -- the old
// Hono/zod-openapi route returned 422 for the same case. HttpApiSchemaError's
// status is hardcoded to 400 in effect/unstable/httpapi and isn't
// configurable per-endpoint.
export const SearchQuery = Schema.Struct({
  q: Schema.NonEmptyString,
  limit: Schema.NumberFromString.pipe(
    Schema.check(Schema.isGreaterThanOrEqualTo(1), Schema.isLessThanOrEqualTo(50)),
    Schema.withDecodingDefaultType(Effect.succeed(10))
  )
})

export const SearchGroup = HttpApiGroup.make('search').add(
  HttpApiEndpoint.get('searchContent', '/api/search', {
    query: SearchQuery,
    success: SearchResults
  })
)
