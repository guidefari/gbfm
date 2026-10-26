import {
  bandcampMediaEmbed,
  directMediaEmbed,
  mediaReference,
  type ExternalMediaEmbed,
} from '@gbfm/rich-content/media'
import type { SafeUrl } from '@gbfm/rich-content/schema'
import { Cache, Context, Duration, Effect, Exit, Option, Schema } from 'effect'

export type ExternalMediaFetch = (input: string, init?: RequestInit) => Promise<Response>

/** Fetches public provider pages whose player address is not derivable from the authored URL. */
export const ExternalMediaFetcher = Context.Reference<ExternalMediaFetch>('ExternalMediaFetcher', {
  defaultValue: () => fetch,
})

export interface BandcampItem {
  readonly kind: 'track' | 'album'
  readonly id: string
  readonly title: string | null
}

export interface BandcampLookup {
  readonly item: BandcampItem | null
  readonly reason:
    | 'resolved'
    | 'rejected-url'
    | 'redirect-limit'
    | 'http-error'
    | 'non-html'
    | 'missing-metadata'
  readonly status?: number
  /** Retained response-prefix bytes, not total response length or an exact head-only slice. */
  readonly headBytes?: number
  readonly pageProperties?: boolean
  readonly openGraphPlayer?: boolean
  /** Presence-only hint in inspected bytes; false does not exclude a challenge. */
  readonly challengeMarkerObserved?: boolean
}

const decodeEntities = (value: string) =>
  value
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&#x27;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')

const metaContent = (html: string, attribute: 'name' | 'property', key: string) => {
  const tag = new RegExp(`<meta\\s[^>]*${attribute}=["']${key}["'][^>]*>`, 'i').exec(html)?.[0]
  const content = tag ? /\scontent=(["'])([\s\S]*?)\1/i.exec(tag)?.[2] : undefined

  return content === undefined ? null : decodeEntities(content)
}

const decodePageProperties = Schema.decodeUnknownOption(
  Schema.fromJsonString(
    Schema.Struct({
      item_type: Schema.Literals(['t', 'a']),
      item_id: Schema.Union([
        Schema.Int,
        Schema.String.pipe(Schema.check(Schema.isPattern(/^\d+$/))),
      ]),
    }),
  ),
)

const itemKinds = { t: 'track', a: 'album' } as const

/** Reads the numeric release ID Bandcamp publishes on every track and album page. */
export const parseBandcampPage = (html: string): BandcampItem | null => {
  const title = metaContent(html, 'property', 'og:title')
  const properties = metaContent(html, 'name', 'bc-page-properties')

  const item = properties === null ? Option.none() : decodePageProperties(properties)

  if (Option.isSome(item))
    return { kind: itemKinds[item.value.item_type], id: String(item.value.item_id), title }

  const player = /bandcamp\.com\/EmbeddedPlayer\/(?:v=\d+\/)?(track|album)=(\d+)/.exec(
    metaContent(html, 'property', 'og:video:secure_url') ??
      metaContent(html, 'property', 'og:video') ??
      '',
  )

  return player?.[1] === 'track' || player?.[1] === 'album'
    ? { kind: player[1], id: player[2] ?? '', title }
    : null
}

const LOOKUP_TIMEOUT = Duration.seconds(4)

/** The release ID sits in <head>; Bandcamp pages are a few hundred KiB, so never buffer more. */
export const MAX_BANDCAMP_PAGE_BYTES = 512 * 1024

const MAX_BANDCAMP_REDIRECTS = 2

/** Only HTTPS Bandcamp release pages are fetched, including every redirect target. */
const bandcampPageUrl = (value: string, base?: string): string | null => {
  const url = URL.parse(value, base)

  return url &&
    url.protocol === 'https:' &&
    !url.username &&
    !url.password &&
    !url.port &&
    mediaReference(url)?.bandcampPage
    ? url.href
    : null
}

/** Reads at most `limit` bytes, stopping early once the document head is complete. */
const readHead = async (response: Response, limit: number) => {
  if (!response.body) return { text: '', bytesRead: 0 }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let html = ''
  let size = 0

  try {
    while (size < limit && !/<\/head>/i.test(html)) {
      const result = await reader.read()

      if (result.done) break
      const chunk = result.value.subarray(0, limit - size)
      size += chunk.byteLength
      html += decoder.decode(chunk, { stream: true })
    }
  } finally {
    await reader.cancel().catch(() => undefined)
  }

  return { text: html + decoder.decode(), bytesRead: size }
}

/**
 * Fetches a Bandcamp release page without following redirects automatically, so a page can never
 * send the request to another host, and without buffering more than the page head.
 */
export const fetchBandcampPage = async (
  fetcher: ExternalMediaFetch,
  url: string,
  signal: AbortSignal,
): Promise<BandcampLookup> => {
  let target = bandcampPageUrl(url)

  for (let hop = 0; target !== null && hop <= MAX_BANDCAMP_REDIRECTS; hop += 1) {
    const response = await fetcher(target, {
      signal,
      redirect: 'manual',
      headers: {
        accept: 'text/html',
        'user-agent': 'Mozilla/5.0 (compatible; goosebumps.fm media embeds)',
      },
    })

    if (response.status >= 300 && response.status < 400) {
      await response.body?.cancel().catch(() => undefined)
      const location = response.headers.get('location')
      target = location === null ? null : bandcampPageUrl(location, target)
      continue
    }

    if (!response.ok || !/^text\/html\b/i.test(response.headers.get('content-type') ?? '')) {
      await response.body?.cancel().catch(() => undefined)

      return {
        item: null,
        reason: response.ok ? 'non-html' : 'http-error',
        status: response.status,
      }
    }

    const head = await readHead(response, MAX_BANDCAMP_PAGE_BYTES)
    const item = parseBandcampPage(head.text)

    return {
      item,
      reason: item === null ? 'missing-metadata' : 'resolved',
      status: response.status,
      headBytes: head.bytesRead,
      pageProperties: metaContent(head.text, 'name', 'bc-page-properties') !== null,
      openGraphPlayer:
        metaContent(head.text, 'property', 'og:video:secure_url') !== null ||
        metaContent(head.text, 'property', 'og:video') !== null,
      challengeMarkerObserved: /challenge-platform|cf-chl-|verify you are human/i.test(head.text),
    }
  }

  return { item: null, reason: target === null ? 'rejected-url' : 'redirect-limit' }
}

export interface ExternalMediaResolver {
  /** Resolves an allowed media link to a player, or null when the provider cannot supply one. */
  readonly resolve: (url: SafeUrl) => Effect.Effect<ExternalMediaEmbed | null>
}

export const makeExternalMediaResolver = Effect.gen(function* () {
  const fetcher = yield* ExternalMediaFetcher

  const bandcamp = yield* Cache.makeWith(
    (url: string) =>
      Effect.tryPromise({
        try: (signal) => fetchBandcampPage(fetcher, url, signal),
        catch: () => 'network-error' as const,
      }).pipe(
        Effect.timeoutOption(LOOKUP_TIMEOUT),
        Effect.flatMap((lookup) => {
          if (Option.isNone(lookup))
            return Effect.logWarning('Bandcamp player lookup unavailable', {
              provider: 'bandcamp',
              reason: 'timeout',
            }).pipe(Effect.as(Option.none<BandcampItem>()))

          const result = lookup.value

          if (result.item !== null) return Effect.succeed(Option.some(result.item))

          return Effect.logWarning('Bandcamp player lookup unavailable', {
            provider: 'bandcamp',
            reason: result.reason,
            status: result.status,
            headBytes: result.headBytes,
            pageProperties: result.pageProperties,
            openGraphPlayer: result.openGraphPlayer,
            challengeMarkerObserved: result.challengeMarkerObserved,
          }).pipe(Effect.as(Option.none<BandcampItem>()))
        }),
        Effect.catch((reason) =>
          Effect.logWarning('Bandcamp player lookup unavailable', {
            provider: 'bandcamp',
            reason,
          }).pipe(Effect.as(Option.none<BandcampItem>())),
        ),
        Effect.withSpan('richContent.bandcampLookup', {
          attributes: { 'media.provider': 'bandcamp' },
        }),
      ),
    {
      capacity: 512,
      // A missing player is usually transient (timeout, rate limit), so retry it soon.
      timeToLive: (exit) =>
        Exit.isSuccess(exit) && Option.isSome(exit.value)
          ? Duration.hours(24)
          : Duration.minutes(5),
    },
  )

  return {
    resolve: (url) => {
      const direct = directMediaEmbed(url)

      if (direct) return Effect.succeed(direct)

      if (!mediaReference(new URL(url))?.bandcampPage) return Effect.succeed(null)

      return Cache.get(bandcamp, url).pipe(
        Effect.map((item) => (Option.isSome(item) ? bandcampMediaEmbed(url, item.value) : null)),
      )
    },
  } satisfies ExternalMediaResolver
})
