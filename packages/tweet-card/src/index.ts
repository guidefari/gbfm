import { Schema } from 'effect'

/** Image variants generated from the shared tweet card model. */
export const TWEET_CARD_FORMATS = ['poster', 'sleeve', 'openGraph'] as const

/** A generated tweet image variant. */
export type TweetCardFormat = (typeof TWEET_CARD_FORMATS)[number]

/** Pixel dimensions of every stable output format. */
export const TWEET_CARD_DIMENSIONS = {
  poster: [1080, 1350],
  sleeve: [1080, 1920],
  openGraph: [1200, 630]
} as const satisfies Readonly<Record<TweetCardFormat, readonly [number, number]>>

const NullableString = Schema.NullOr(Schema.String)

/** Runtime contract consumed by every tweet card renderer. */
export const TweetCardModel = Schema.Struct({
  commentary: Schema.String,
  authorName: NullableString,
  username: NullableString,
  avatarUrl: NullableString,
  dateLabel: NullableString,
  entityLabel: NullableString,
  entityTitle: NullableString,
  entityArtists: NullableString,
  coverImageUrl: NullableString,
  url: Schema.String
})

/** Parsed tweet card model. */
export type TweetCardModel = typeof TweetCardModel.Type

/** Runtime response contract shared by the API, edge metadata, and browser UI. */
export const TweetCardPresentation = Schema.Struct({
  model: TweetCardModel,
  revision: Schema.String,
  images: Schema.Struct({
    poster: Schema.String,
    sleeve: Schema.String,
    openGraph: Schema.String
  })
})

/** Parsed tweet share presentation. */
export type TweetCardPresentation = typeof TweetCardPresentation.Type

/** Supported music entity input for a tweet card. */
export type TweetCardEntityInput = {
  readonly type: 'album' | 'track' | 'playlist'
  readonly title: string
  readonly artists: ReadonlyArray<string> | null
  readonly coverImageUrl: string | null
}

/** Source data required to create a complete share presentation. */
export type TweetCardPresentationInput = {
  readonly slug: string
  readonly commentary: string
  readonly createdAt: string
  readonly creator: {
    readonly name: string
    readonly username: string | null
    readonly avatarUrl: string | null
  } | null
  readonly entity: TweetCardEntityInput | null
}

const TEMPLATE_VERSION = 'tweet-card-v1'
const SITE_URL = 'https://goosebumps.fm'

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC'
})

const entityLabels = {
  album: 'ALBUM',
  track: 'TRACK',
  playlist: 'PLAYLIST'
} as const satisfies Readonly<Record<TweetCardEntityInput['type'], string>>

const revisionFor = async (model: TweetCardModel) => {
  const encoded = new TextEncoder().encode(JSON.stringify([TEMPLATE_VERSION, model]))
  const digest = await crypto.subtle.digest('SHA-256', encoded)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 16)
}

/** Normalizes source data and derives immutable URLs for all image formats. */
export const buildTweetCardPresentation = async (
  input: TweetCardPresentationInput
): Promise<TweetCardPresentation> => {
  const entity = input.entity
  const model: TweetCardModel = {
    commentary: input.commentary,
    authorName: input.creator?.name ?? null,
    username: input.creator?.username ?? null,
    avatarUrl: input.creator?.avatarUrl ?? null,
    dateLabel: dateFormatter.format(new Date(input.createdAt)),
    entityLabel: entity ? entityLabels[entity.type] : null,
    entityTitle: entity?.title ?? null,
    entityArtists: entity?.artists?.length ? entity.artists.join(', ') : null,
    coverImageUrl: entity?.coverImageUrl ?? null,
    url: `${SITE_URL}/tweet/${encodeURIComponent(input.slug)}`
  }
  const revision = await revisionFor(model)
  const base = `${SITE_URL}/social/tweets/${encodeURIComponent(input.slug)}/${revision}`

  return {
    model,
    revision,
    images: {
      poster: `${base}/poster.png`,
      sleeve: `${base}/sleeve.png`,
      openGraph: `${base}/open-graph.png`
    }
  }
}
