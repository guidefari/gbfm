import { Schema } from 'effect'
import { TweetCardPresentation, type TweetCardFormat, type TweetCardModel } from '@gbfm/tweet-card'
import { renderTweetCard, type TweetCardRenderAssets } from './render'

type Fetcher = {
  readonly fetch: (request: Request) => Promise<Response>
}

type StoredObject = {
  readonly body: BodyInit
}

type ListedObject = {
  readonly key: string
  readonly uploaded: Date
}

type ObjectList = {
  readonly objects: ReadonlyArray<ListedObject>
  readonly truncated: boolean
  readonly cursor?: string
}

type CardBucket = {
  readonly get: (key: string) => Promise<StoredObject | null>
  readonly put: (
    key: string,
    bytes: Uint8Array,
    options?: { readonly httpMetadata: { readonly contentType: string } }
  ) => Promise<unknown>
  list: (options?: { readonly prefix?: string; readonly cursor?: string }) => Promise<ObjectList>
  readonly delete: (keys: string | string[]) => Promise<unknown>
}

/** Bindings used by the social image Worker. */
export interface SocialImageEnv {
  readonly API: Fetcher
  readonly ASSETS: Fetcher
  readonly CARDS: CardBucket
}

type Render = (model: TweetCardModel, format: TweetCardFormat) => Promise<Uint8Array>

const RETENTION_MS = 30 * 24 * 60 * 60 * 1_000
const MAX_IMAGE_BYTES = 8 * 1024 * 1024
const cacheHeaders = {
  'cache-control': 'public, max-age=31536000, immutable',
  'content-type': 'image/png',
  'x-content-type-options': 'nosniff'
}

const imageFormat = (filename: string): TweetCardFormat | null => {
  if (filename === 'poster.png') return 'poster'
  if (filename === 'sleeve.png') return 'sleeve'
  if (filename === 'open-graph.png') return 'openGraph'
  return null
}

const parseImagePath = (pathname: string) => {
  const match = /^\/social\/tweets\/([^/]+)\/([a-f0-9]{16})\/([^/]+)$/.exec(pathname)
  if (!match) return null
  const [, encodedSlug, revision, filename] = match
  const format = filename ? imageFormat(filename) : null
  if (!encodedSlug || !revision || !format) return null
  try {
    return { slug: decodeURIComponent(encodedSlug), revision, format }
  } catch {
    return null
  }
}

const decodePresentation = Schema.decodeUnknownSync(TweetCardPresentation)

const fetchPresentation = async (env: SocialImageEnv, slug: string) => {
  const response = await env.API.fetch(
    new Request(
      `https://api.internal/api/content/posts/micro/${encodeURIComponent(slug)}/share-presentation`
    )
  )
  if (!response.ok) return null
  return decodePresentation(await response.json())
}

const bytesToBase64 = (bytes: Uint8Array) => {
  let binary = ''
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000))
  }
  return btoa(binary)
}

const renderAssets = (env: SocialImageEnv): TweetCardRenderAssets => ({
  loadBinary: async (name) => {
    const response = await env.ASSETS.fetch(new Request(`https://assets.internal/${name}`))
    if (!response.ok) throw new Error(`Render asset ${name} returned ${response.status}`)
    return response.arrayBuffer()
  },
  loadImage: async (value) => {
    try {
      const url = new URL(value)
      if (url.protocol !== 'https:') return null
      const response = await fetch(url, { signal: AbortSignal.timeout(5_000) })
      if (!response.ok) return null
      const contentType = response.headers.get('content-type')?.split(';')[0]
      const declaredSize = Number(response.headers.get('content-length') ?? 0)
      if (!contentType?.startsWith('image/') || declaredSize > MAX_IMAGE_BYTES) return null
      const bytes = new Uint8Array(await response.arrayBuffer())
      if (bytes.byteLength > MAX_IMAGE_BYTES) return null
      return `data:${contentType};base64,${bytesToBase64(bytes)}`
    } catch {
      return null
    }
  }
})

const imageFor = (presentation: TweetCardPresentation, format: TweetCardFormat) =>
  presentation.images[format]

/** Serves immutable generated cards and redirects stale revisions to current content. */
export const handleRequest = async (
  request: Request,
  env: SocialImageEnv,
  render?: Render
): Promise<Response> => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method not allowed', { status: 405, headers: { allow: 'GET, HEAD' } })
  }
  const route = parseImagePath(new URL(request.url).pathname)
  if (!route) return new Response('Not found', { status: 404 })

  try {
    const presentation = await fetchPresentation(env, route.slug)
    if (!presentation) return new Response('Not found', { status: 404 })
    if (presentation.revision !== route.revision) {
      return Response.redirect(imageFor(presentation, route.format), 302)
    }

    const key = `tweet-cards/${route.slug}/${route.revision}/${route.format}.png`
    const cached = await env.CARDS.get(key)
    if (cached) {
      return new Response(request.method === 'HEAD' ? null : cached.body, { headers: cacheHeaders })
    }

    const bytes = await (
      render ?? ((model, format) => renderTweetCard(model, format, renderAssets(env)))
    )(presentation.model, route.format)
    await env.CARDS.put(key, bytes, { httpMetadata: { contentType: 'image/png' } })
    return new Response(request.method === 'HEAD' ? null : bytes, { headers: cacheHeaders })
  } catch (error) {
    console.error('social image request failed', {
      method: request.method,
      format: route.format,
      revision: route.revision,
      errorName: error instanceof Error ? error.name : 'UnknownError'
    })
    return new Response('Image generation failed', { status: 500 })
  }
}

/** Deletes generated cards after 30 days; a requested current revision regenerates on demand. */
export const cleanupExpiredCards = async (bucket: CardBucket, now: Date) => {
  const cutoff = now.getTime() - RETENTION_MS
  let cursor: string | undefined
  let scanned = 0
  let deleted = 0

  do {
    const page = await bucket.list({ prefix: 'tweet-cards/', ...(cursor ? { cursor } : undefined) })
    scanned += page.objects.length
    const expired = page.objects
      .filter((object) => object.uploaded.getTime() < cutoff)
      .map((object) => object.key)
    if (expired.length > 0) {
      await bucket.delete(expired)
      deleted += expired.length
    }
    cursor = page.truncated ? page.cursor : undefined
  } while (cursor)

  return { scanned, deleted }
}

export default {
  fetch: (request: Request, env: SocialImageEnv, _context: Pick<ExecutionContext, 'waitUntil'>) =>
    handleRequest(request, env),
  scheduled: (_controller: ScheduledController, env: SocialImageEnv): Promise<void> =>
    cleanupExpiredCards(env.CARDS, new Date()).then((report) => {
      console.log('social image cleanup finished', report)
    })
}
