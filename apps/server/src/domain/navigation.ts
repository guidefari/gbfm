import { Schema } from 'effect'

export const Slug = Schema.String.pipe(Schema.brand('MicroPostSlug'))

export type Slug = typeof Slug.Type

export type NavigationIdentity =
  | { readonly _tag: 'User'; readonly userId: string }
  | { readonly _tag: 'Anonymous'; readonly deviceToken: string }

export type MicroPostTimelineMonth = {
  readonly month: string
  readonly total: number
  readonly unread: number
  readonly newestSlug: Slug
}

export type MicroPostNeighbours = {
  readonly newer: Slug | null
  readonly older: Slug | null
  readonly olderUnread: Slug | null
  readonly seen: boolean
  readonly unreadCount: number
  readonly timeline: ReadonlyArray<MicroPostTimelineMonth>
}

export class MicroPostMissing extends Schema.TaggedError<MicroPostMissing>()('MicroPostMissing', {
  slug: Schema.String,
}) {}

export class CorpusExhausted extends Schema.TaggedError<CorpusExhausted>()('CorpusExhausted', {}) {}
