import { Context, Effect, Layer, Option, Schema } from 'effect'

const musicHosts = new Set([
  'open.spotify.com',
  'music.apple.com',
  'soundcloud.com',
  'youtube.com',
  'youtu.be',
  'music.youtube.com',
  'tidal.com',
  'deezer.com',
  'audiomack.com'
])

const FacetFeature = Schema.Struct({
  $type: Schema.optional(Schema.String),
  uri: Schema.optional(Schema.String),
  tag: Schema.optional(Schema.String)
})

const Facet = Schema.Struct({
  index: Schema.Struct({
    byteStart: Schema.Number,
    byteEnd: Schema.Number
  }),
  features: Schema.Array(Schema.Unknown)
})

const ExternalEmbed = Schema.Struct({
  $type: Schema.String,
  external: Schema.Struct({ uri: Schema.optional(Schema.String) })
})

const FeedEntry = Schema.Struct({
  post: Schema.Struct({
    uri: Schema.NonEmptyString,
    cid: Schema.NonEmptyString,
    author: Schema.Struct({
      did: Schema.NonEmptyString,
      handle: Schema.optional(Schema.String)
    }),
    record: Schema.Struct({
      text: Schema.String,
      createdAt: Schema.NonEmptyString,
      facets: Schema.optional(Schema.Array(Schema.Unknown)),
      embed: Schema.optional(Schema.Unknown)
    })
  }),
  reason: Schema.optional(Schema.Unknown)
})

type FeedEntryRecord = Schema.Schema.Type<typeof FeedEntry>['post']['record']
type FeedEntryInput = Parameters<typeof decodeFeedEntry>[0]

const RepostMarker = Schema.Struct({ reason: Schema.Unknown })
const decodeRepostMarker = Schema.decodeUnknownOption(RepostMarker)
const decodeFeedEntry = Schema.decodeUnknownOption(FeedEntry)
const decodeFacet = Schema.decodeUnknownOption(Facet)
const decodeFacetFeature = Schema.decodeUnknownOption(FacetFeature)
const decodeExternalEmbed = Schema.decodeUnknownOption(ExternalEmbed)

const isIsoTimestamp = (value: string): boolean => !Number.isNaN(Date.parse(value))

export type ImportedRecord = {
  readonly atUri: string
  readonly cid: string
  readonly authorDid: string
  readonly authorHandle: string
  readonly text: string
  readonly normalizedContent: string
  readonly candidateUrls: ReadonlyArray<string>
  readonly tags: ReadonlyArray<string>
  readonly publicUrl: string
  readonly sourceCreatedAt: Date
}

export type ImportSkipReason = 'repost' | 'different-author' | 'malformed' | 'not-qualifying'

export type ImportBatchSummary = {
  readonly discovered: number
  readonly qualifying: number
  readonly records: ReadonlyArray<ImportedRecord>
  readonly skipped: Readonly<Record<ImportSkipReason, number>>
}

export interface BlueskyImportService {
  readonly normalizeFeed: (
    entries: ReadonlyArray<unknown>,
    expectedAuthorDid: string
  ) => Effect.Effect<ImportBatchSummary>
}

export const BlueskyImportService = Context.Service<BlueskyImportService>('BlueskyImportService')

export type NormalizedBlueskyRecord =
  | { readonly kind: 'import'; readonly record: ImportedRecord }
  | { readonly kind: 'skip'; readonly reason: ImportSkipReason }

const isLinkHost = (value: string): boolean => {
  try {
    const host = new URL(value).hostname.toLowerCase()
    return musicHosts.has(host) || host.endsWith('.bandcamp.com')
  } catch {
    return false
  }
}

const publicUrlFromAtUri = (atUri: string, did: string): string => {
  const rkey = atUri.split('/').at(-1) ?? atUri
  return `https://bsky.app/profile/${did}/post/${rkey}`
}

const replaceFacetLinks = (
  text: string,
  replacements: ReadonlyArray<{
    readonly start: number
    readonly end: number
    readonly uri: string
  }>
): string => {
  const bytes = Buffer.from(text, 'utf8')
  return replacements
    .toSorted((left, right) => right.start - left.start)
    .reduce(
      (result, replacement) =>
        Buffer.concat([
          result.subarray(0, replacement.start),
          Buffer.from(replacement.uri),
          result.subarray(replacement.end)
        ]),
      bytes
    )
    .toString('utf8')
}

const extractSignals = (record: FeedEntryRecord) => {
  const urls: Array<string> = []
  const tags: Array<string> = []
  const replacements: Array<{ start: number; end: number; uri: string }> = []

  for (const facetInput of record.facets ?? []) {
    const facet = decodeFacet(facetInput)
    if (Option.isNone(facet)) continue
    const start = facet.value.index.byteStart
    const end = facet.value.index.byteEnd

    for (const featureInput of facet.value.features) {
      const feature = decodeFacetFeature(featureInput)
      if (Option.isNone(feature)) continue
      const type = feature.value.$type
      if (type?.endsWith('#link')) {
        const uri = feature.value.uri
        if (uri) {
          urls.push(uri)
          replacements.push({ start, end, uri })
        }
      }
      if (type?.endsWith('#tag')) {
        const tag = feature.value.tag
        if (tag) tags.push(tag.toLowerCase())
      }
    }
  }

  const embed = Option.getOrUndefined(decodeExternalEmbed(record.embed))
  if (
    embed?.$type === 'app.bsky.embed.external' ||
    embed?.$type === 'app.bsky.embed.external#view'
  ) {
    const uri = embed.external.uri
    if (uri) urls.push(uri)
  }

  return { urls: [...new Set(urls)], tags: [...new Set(tags)], replacements }
}

export const normalizeBlueskyRecord = (
  input: FeedEntryInput,
  expectedAuthorDid: string
): NormalizedBlueskyRecord => {
  const repost = decodeRepostMarker(input)
  if (Option.isSome(repost) && repost.value.reason !== undefined) {
    return { kind: 'skip', reason: 'repost' }
  }

  const parsed = decodeFeedEntry(input)
  if (Option.isNone(parsed)) return { kind: 'skip', reason: 'malformed' }
  if (!isIsoTimestamp(parsed.value.post.record.createdAt)) {
    return { kind: 'skip', reason: 'malformed' }
  }
  if (parsed.value.post.author.did !== expectedAuthorDid) {
    return { kind: 'skip', reason: 'different-author' }
  }

  const { post } = parsed.value
  const signals = extractSignals(post.record)
  const candidateUrls = signals.urls.filter((url) => isLinkHost(url))
  const qualifies =
    candidateUrls.length > 0 || signals.tags.some((tag) => tag.replace(/^#/, '') === 'gbfm')
  if (!qualifies) return { kind: 'skip', reason: 'not-qualifying' }

  return {
    kind: 'import',
    record: {
      atUri: post.uri,
      cid: post.cid,
      authorDid: post.author.did,
      authorHandle: post.author.handle ?? post.author.did,
      text: post.record.text,
      normalizedContent: replaceFacetLinks(post.record.text, signals.replacements),
      candidateUrls,
      tags: signals.tags,
      publicUrl: publicUrlFromAtUri(post.uri, post.author.did),
      sourceCreatedAt: new Date(post.record.createdAt)
    }
  }
}

type SkipCounts = Record<ImportSkipReason, number>

const emptySkipped = (): SkipCounts => ({
  repost: 0,
  'different-author': 0,
  malformed: 0,
  'not-qualifying': 0
})

const normalizeFeed = (
  entries: ReadonlyArray<unknown>,
  expectedAuthorDid: string
): Effect.Effect<ImportBatchSummary> =>
  Effect.forEach(entries, (entry) =>
    Effect.sync(() => normalizeBlueskyRecord(entry, expectedAuthorDid))
  ).pipe(
    Effect.map((results) => {
      const skipped = emptySkipped()
      const records: Array<ImportedRecord> = []
      for (const result of results) {
        if (result.kind === 'import') records.push(result.record)
        else skipped[result.reason] += 1
      }
      return {
        discovered: entries.length,
        qualifying: records.length,
        records,
        skipped
      }
    })
  )

export const BlueskyImportServiceLayer = Layer.succeed(BlueskyImportService, {
  normalizeFeed
})
