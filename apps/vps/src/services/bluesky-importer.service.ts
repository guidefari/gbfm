import { z } from 'zod'

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

const stringRecord = z.record(z.string(), z.unknown())
const feedEntrySchema = z.object({
  post: z.object({
    uri: z.string().min(1),
    cid: z.string().min(1),
    author: z.object({ did: z.string().min(1), handle: z.string().optional() }),
    record: z.object({
      text: z.string(),
      createdAt: z.string().datetime({ offset: true }),
      facets: z.array(z.unknown()).optional(),
      embed: z.unknown().optional()
    })
  }),
  reason: z.unknown().optional()
})

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

export type NormalizedBlueskyRecord =
  | { readonly kind: 'import'; readonly record: ImportedRecord }
  | { readonly kind: 'skip'; readonly reason: ImportSkipReason }

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const getString = (value: unknown, key: string): string | undefined => {
  if (!isRecord(value)) return undefined
  const candidate = value[key]
  return typeof candidate === 'string' ? candidate : undefined
}

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

const extractSignals = (record: z.infer<typeof feedEntrySchema>['post']['record']) => {
  const urls: Array<string> = []
  const tags: Array<string> = []
  const replacements: Array<{ start: number; end: number; uri: string }> = []

  for (const facet of record.facets ?? []) {
    if (!isRecord(facet)) continue
    const index = isRecord(facet.index) ? facet.index : undefined
    const start = index?.byteStart
    const end = index?.byteEnd
    if (typeof start !== 'number' || typeof end !== 'number') continue

    for (const feature of Array.isArray(facet.features) ? facet.features : []) {
      const type = getString(feature, '$type')
      if (type?.endsWith('#link')) {
        const uri = getString(feature, 'uri')
        if (uri) {
          urls.push(uri)
          replacements.push({ start, end, uri })
        }
      }
      if (type?.endsWith('#tag')) {
        const tag = getString(feature, 'tag')
        if (tag) tags.push(tag.toLowerCase())
      }
    }
  }

  const embed = isRecord(record.embed) ? record.embed : undefined
  if (
    embed?.$type === 'app.bsky.embed.external' ||
    embed?.$type === 'app.bsky.embed.external#view'
  ) {
    const external = isRecord(embed.external) ? embed.external : undefined
    const uri = getString(external, 'uri')
    if (uri) urls.push(uri)
  }

  return { urls: [...new Set(urls)], tags: [...new Set(tags)], replacements }
}

export const normalizeBlueskyRecord = (
  input: unknown,
  expectedAuthorDid: string
): NormalizedBlueskyRecord => {
  if (isRecord(input) && input.reason !== undefined) return { kind: 'skip', reason: 'repost' }

  const parsed = feedEntrySchema.safeParse(input)
  if (!parsed.success) return { kind: 'skip', reason: 'malformed' }
  if (parsed.data.post.author.did !== expectedAuthorDid) {
    return { kind: 'skip', reason: 'different-author' }
  }

  const { post } = parsed.data
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
