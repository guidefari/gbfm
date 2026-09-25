import { Schema } from 'effect'

export const Slug = Schema.String.pipe(Schema.brand('MicroPostSlug'))

export type Slug = typeof Slug.Type

export type NavigationIdentity =
  | { readonly _tag: 'User'; readonly userId: string }
  | { readonly _tag: 'Anonymous'; readonly deviceToken: string }

export type MicroPostNeighbours = {
  readonly back: Slug | null
  readonly forward: Slug | null
  readonly hasUnread: boolean
}

export class MicroPostMissing extends Schema.TaggedError<MicroPostMissing>()('MicroPostMissing', {
  slug: Schema.String,
}) {}

export class CorpusExhausted extends Schema.TaggedError<CorpusExhausted>()('CorpusExhausted', {}) {}
