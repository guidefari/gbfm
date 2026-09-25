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
}

export type MicroPostNeighbours = {
  readonly back: Slug | null
  readonly forward: Slug | null
  readonly position: number
  readonly total: number
  readonly unreadCount: number
  readonly timeline: ReadonlyArray<MicroPostTimelineMonth>
}

export class MicroPostMissing extends Schema.TaggedError<MicroPostMissing>()('MicroPostMissing', {
  slug: Schema.String,
}) {}

export class CorpusExhausted extends Schema.TaggedError<CorpusExhausted>()('CorpusExhausted', {}) {}
