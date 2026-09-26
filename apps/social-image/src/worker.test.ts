import {
  buildSocialCardPresentation,
  buildTweetCardPresentation,
  type SocialCardPresentation,
  type TweetCardPresentation,
} from '@gbfm/social-card'
import { afterEach, describe, expect, test, vi } from 'vitest'

import worker, {
  cleanupExpiredCards,
  handleRequest,
  loadRemoteImage,
  type SocialImageEnv,
} from './worker'

const presentation = async (): Promise<TweetCardPresentation> =>
  buildTweetCardPresentation({
    slug: 'vusa-just-resurfaced',
    commentary: 'Vusa just resurfaced this.',
    createdAt: '2026-09-13T10:00:00.000Z',
    creator: { name: 'Guide', username: 'guide', avatarUrl: null },
    entity: { type: 'album', title: 'Vusa', artists: ['M3NSA'], coverImageUrl: null },
  })

const mixPresentation = (): Promise<SocialCardPresentation> =>
  buildSocialCardPresentation({
    kind: 'mix',
    slug: 'forest-drive-west-at-gbfm',
    title: 'Forest Drive West at goosebumps.fm',
    creators: ['Forest Drive West'],
    imageUrl: null,
  })

const testEnv = (
  card: SocialCardPresentation,
  objects = new Map<string, Uint8Array>(),
): SocialImageEnv & { readonly deleted: Array<string> } => {
  const deleted: Array<string> = []

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
      },
    },
  }
}

const imageResponse = (url: string) => {
  const response = new Response(new Uint8Array([137, 80, 78, 71]), {
    headers: { 'content-type': 'image/png' },
  })

  Object.defineProperty(response, 'url', { value: url })

  return response
}

describe('social image worker', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('keeps the runtime execution context out of the renderer seam', async () => {
    const card = await presentation()
    const requestedAssets: Array<string> = []

    const env = {
      ...testEnv(card),
      ASSETS: {
        fetch: async (request: Request) => {
          requestedAssets.push(new URL(request.url).pathname)

          return new Response('temporarily unavailable', { status: 503 })
        },
      },
    }

    vi.spyOn(console, 'error').mockImplementation(() => {})
    const context: Pick<ExecutionContext, 'waitUntil'> = { waitUntil: () => {} }

    const response = await worker.fetch(new Request(card.images.openGraph), env, context)

    expect(response.status).toBe(500)
    expect(requestedAssets).toContain('/JetBrainsMono-Bold.ttf')
  })

  test('renders and stores a revisioned card on cache miss', async () => {
    const card = await mixPresentation()
    const env = testEnv(card)
    const rendered = new Uint8Array([137, 80, 78, 71])

    const response = await handleRequest(
      new Request(card.images.openGraph),
      env,
      async () => rendered,
    )

    expect(response.status).toBe(200)
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(rendered)
    expect(response.headers.get('cache-control')).toBe('public, max-age=31536000, immutable')
    expect(
      await env.CARDS.get(
        `social-cards/mix/forest-drive-west-at-gbfm/${card.revision}/openGraph.png`,
      ),
    ).not.toBeNull()
  })

  test('serves cached bytes without rasterizing again', async () => {
    const card = await presentation()
    const key = `social-cards/tweet/vusa-just-resurfaced/${card.revision}/poster.png`
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

  test('serves a rendered card when the optional R2 cache write fails', async () => {
    const card = await presentation()
    const baseEnv = testEnv(card)

    const env: SocialImageEnv = {
      ...baseEnv,
      CARDS: {
        ...baseEnv.CARDS,
        put: async () => {
          throw new Error('R2 unavailable')
        },
      },
    }

    vi.spyOn(console, 'error').mockImplementation(() => {})
    const rendered = new Uint8Array([137, 80, 78, 71])

    const response = await handleRequest(
      new Request(card.images.openGraph),
      env,
      async () => rendered,
    )

    expect(response.status).toBe(200)
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(rendered)
  })

  test('redirects an obsolete revision to the current immutable URL', async () => {
    const card = await presentation()
    const env = testEnv(card)

    const response = await handleRequest(
      new Request(
        'https://goosebumps.fm/social/tweets/vusa-just-resurfaced/0000000000000000/sleeve.png',
      ),
      env,
      async () => new Uint8Array(),
    )

    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe(card.images.sleeve)
  })

  test('redirects a legacy tweet URL to the canonical shared route', async () => {
    const card = await presentation()
    const legacyUrl = `https://goosebumps.fm/social/tweets/vusa-just-resurfaced/${card.revision}/open-graph.png`

    const response = await handleRequest(
      new Request(legacyUrl),
      testEnv(card),
      async () => new Uint8Array(),
    )

    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe(card.images.openGraph)
  })

  test('rejects a poster format for non-tweet content', async () => {
    const card = await mixPresentation()

    const response = await handleRequest(
      new Request(
        `https://goosebumps.fm/social/cards/mix/forest-drive-west-at-gbfm/${card.revision}/poster.png`,
      ),
      testEnv(card),
      async () => new Uint8Array(),
    )

    expect(response.status).toBe(404)
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
      },
    )

    expect(response.status).toBe(500)
    expect(error).toHaveBeenCalledWith(
      'social image request failed',
      expect.objectContaining({
        method: 'GET',
        format: 'poster',
        revision: card.revision,
        errorName: 'Error',
      }),
    )
    expect(JSON.stringify(error.mock.calls)).not.toContain(privateContent)
  })

  test('loads images from approved production and music hosts', async () => {
    const requests: Array<string> = []

    const fetchImage = async (url: URL) => {
      requests.push(url.href)

      return imageResponse(url.href)
    }

    const cdnImage = await loadRemoteImage(
      'https://cdn.goosebumps.fm/user-content/cover.png',
      fetchImage,
    )

    const musicImage = await loadRemoteImage('https://i.scdn.co/image/cover', fetchImage)

    expect(cdnImage).toBe('data:image/png;base64,iVBORw==')
    expect(musicImage).toBe('data:image/png;base64,iVBORw==')
    expect(requests).toEqual([
      'https://cdn.goosebumps.fm/user-content/cover.png',
      'https://i.scdn.co/image/cover',
    ])
  })

  test.each([
    'http://cdn.goosebumps.fm/user-content/cover.png',
    'https://user:password@cdn.goosebumps.fm/user-content/cover.png',
    'https://api.internal/private.png',
    'https://localhost/private.png',
    'https://127.0.0.1/private.png',
    'https://evilbcbits.com/cover.png',
    'https://cdn.goosebumps.fm.attacker.example/cover.png',
  ])('rejects unapproved image URL %s without fetching it', async (url) => {
    let requests = 0

    const image = await loadRemoteImage(url, async () => {
      requests += 1

      return imageResponse(url)
    })

    expect(image).toBeNull()
    expect(requests).toBe(0)
  })

  test('rejects a redirect from an approved image host to an unapproved host', async () => {
    let requests = 0

    const image = await loadRemoteImage('https://i.scdn.co/image/cover', async () => {
      requests += 1

      return imageResponse('https://api.internal/private.png')
    })

    expect(image).toBeNull()
    expect(requests).toBe(1)
  })

  test('deletes only generated cards older than the retention window', async () => {
    const card = await presentation()
    const env = testEnv(card)
    env.CARDS.list = async ({ prefix } = {}) => {
      if (prefix === 'social-cards/') {
        return {
          objects: [
            {
              key: 'social-cards/mix/old.png',
              uploaded: new Date('2026-07-01T00:00:00.000Z'),
            },
            {
              key: 'social-cards/mix/current.png',
              uploaded: new Date('2026-09-01T00:00:00.000Z'),
            },
          ],
          truncated: false,
        }
      }

      if (prefix === 'tweet-cards/') {
        return {
          objects: [
            {
              key: 'tweet-cards/legacy/old.png',
              uploaded: new Date('2026-07-01T00:00:00.000Z'),
            },
          ],
          truncated: false,
        }
      }

      return { objects: [], truncated: false }
    }

    const report = await cleanupExpiredCards(env.CARDS, new Date('2026-09-13T00:00:00.000Z'))

    expect(report).toEqual({ scanned: 3, deleted: 2 })
    expect(env.deleted).toEqual(['social-cards/mix/old.png', 'tweet-cards/legacy/old.png'])
  })
})
