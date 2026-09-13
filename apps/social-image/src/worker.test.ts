import { buildTweetCardPresentation, type TweetCardPresentation } from '@gbfm/tweet-card'
import { afterEach, describe, expect, test, vi } from 'vitest'
import worker, { cleanupExpiredCards, handleRequest, type SocialImageEnv } from './worker'

const presentation = async (): Promise<TweetCardPresentation> =>
  buildTweetCardPresentation({
    slug: 'vusa-just-resurfaced',
    commentary: 'Vusa just resurfaced this.',
    createdAt: '2026-09-13T10:00:00.000Z',
    creator: { name: 'Guide', username: 'guide', avatarUrl: null },
    entity: { type: 'album', title: 'Vusa', artists: ['M3NSA'], coverImageUrl: null }
  })

const testEnv = (
  card: TweetCardPresentation,
  objects = new Map<string, Uint8Array>()
): SocialImageEnv & { readonly deleted: string[] } => {
  const deleted: string[] = []
  return {
    deleted,
    API: { fetch: async () => Response.json(card) },
    ASSETS: { fetch: async () => new Response(new Uint8Array([1])) },
    CARDS: {
      get: async (key) => {
        const bytes = objects.get(key)
        return bytes ? { body: bytes } : null
      },
      put: async (key, bytes) => {
        objects.set(key, bytes)
      },
      list: async () => ({ objects: [], truncated: false }),
      delete: async (keys) => {
        deleted.push(...(Array.isArray(keys) ? keys : [keys]))
      }
    }
  }
}

describe('social image worker', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('keeps the runtime execution context out of the renderer seam', async () => {
    const card = await presentation()
    const requestedAssets: string[] = []
    const env = {
      ...testEnv(card),
      ASSETS: {
        fetch: async (request: Request) => {
          requestedAssets.push(new URL(request.url).pathname)
          return new Response('temporarily unavailable', { status: 503 })
        }
      }
    }
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const context: Pick<ExecutionContext, 'waitUntil'> = { waitUntil: () => {} }

    const response = await worker.fetch(new Request(card.images.openGraph), env, context)

    expect(response.status).toBe(500)
    expect(requestedAssets).toContain('/yoga.wasm')
  })

  test('renders and stores a revisioned card on cache miss', async () => {
    const card = await presentation()
    const env = testEnv(card)
    const rendered = new Uint8Array([137, 80, 78, 71])
    const response = await handleRequest(
      new Request(card.images.openGraph),
      env,
      async () => rendered
    )

    expect(response.status).toBe(200)
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(rendered)
    expect(response.headers.get('cache-control')).toBe('public, max-age=31536000, immutable')
    expect(
      await env.CARDS.get(`tweet-cards/vusa-just-resurfaced/${card.revision}/openGraph.png`)
    ).not.toBeNull()
  })

  test('serves cached bytes without rasterizing again', async () => {
    const card = await presentation()
    const key = `tweet-cards/vusa-just-resurfaced/${card.revision}/poster.png`
    const cached = new Uint8Array([4, 3, 2, 1])
    const env = testEnv(card, new Map([[key, cached]]))
    let renders = 0
    const response = await handleRequest(new Request(card.images.poster), env, async () => {
      renders += 1
      return new Uint8Array()
    })

    expect(new Uint8Array(await response.arrayBuffer())).toEqual(cached)
    expect(renders).toBe(0)
  })

  test('redirects an obsolete revision to the current immutable URL', async () => {
    const card = await presentation()
    const env = testEnv(card)
    const response = await handleRequest(
      new Request(
        'https://goosebumps.fm/social/tweets/vusa-just-resurfaced/0000000000000000/sleeve.png'
      ),
      env,
      async () => new Uint8Array()
    )

    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe(card.images.sleeve)
  })

  test('logs safe request diagnostics when image generation fails', async () => {
    const card = await presentation()
    const privateContent = 'PRIVATE TWEET CONTENT MUST NOT LEAK'
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const response = await handleRequest(
      new Request(card.images.poster),
      testEnv(card),
      async () => {
        throw new Error(privateContent)
      }
    )

    expect(response.status).toBe(500)
    expect(error).toHaveBeenCalledWith(
      'social image request failed',
      expect.objectContaining({
        method: 'GET',
        format: 'poster',
        revision: card.revision,
        errorName: 'Error'
      })
    )
    expect(JSON.stringify(error.mock.calls)).not.toContain(privateContent)
  })

  test('deletes only generated cards older than the retention window', async () => {
    const card = await presentation()
    const env = testEnv(card)
    env.CARDS.list = async () => ({
      objects: [
        { key: 'tweet-cards/old.png', uploaded: new Date('2026-07-01T00:00:00.000Z') },
        { key: 'tweet-cards/current.png', uploaded: new Date('2026-09-01T00:00:00.000Z') }
      ],
      truncated: false
    })

    const report = await cleanupExpiredCards(env.CARDS, new Date('2026-09-13T00:00:00.000Z'))

    expect(report).toEqual({ scanned: 2, deleted: 1 })
    expect(env.deleted).toEqual(['tweet-cards/old.png'])
  })
})
