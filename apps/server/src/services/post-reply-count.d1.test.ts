import { randomUUID } from 'node:crypto'
import { Effect, Layer } from 'effect'
import { beforeAll, describe, expect, test } from 'vitest'
import { postsTable } from '@/db/post.schema'
import { MdxServiceLayer } from '@/lib/mdx'
import { ConfigServiceLayer } from '@/services/config.service'
import { SentryEnabled, type SentryService, SentryServiceLayer } from '@/services/sentry.service'
import { UploadAssetServiceLayer } from '@/services/upload-asset.service'
import { DatabaseTestLayer, db } from '@/test/database'
import { withTestLayer } from '@/test/effect'
import { PostService, PostServiceLayer } from './post.service'

const SEARCH_TERM = 'zephyrine'

const parentWithRepliesId = randomUUID()
const parentWithoutRepliesId = randomUUID()

const TestPostServiceLayer = PostServiceLayer.pipe(
  Layer.provide(MdxServiceLayer),
  Layer.provide(Layer.mergeAll(ConfigServiceLayer, UploadAssetServiceLayer)),
  Layer.provide(DatabaseTestLayer)
)

const TestSentryLayer = SentryServiceLayer.pipe(
  Layer.provide(Layer.succeed(SentryEnabled, { enabled: false }))
)

const runPostEffect = <A, E>(fn: (service: PostService) => Effect.Effect<A, E, SentryService>) =>
  Effect.runPromise(
    withTestLayer(
      Effect.gen(function* () {
        const service = yield* PostService
        return yield* fn(service)
      }),
      Layer.mergeAll(TestPostServiceLayer, TestSentryLayer)
    )
  )

beforeAll(async () => {
  await db.insert(postsTable).values([
    {
      id: parentWithRepliesId,
      title: `${SEARCH_TERM} parent with replies`,
      slug: `zephyrine-parent-replies-${parentWithRepliesId}`,
      content: 'parent body',
      type: 'micro',
      draft: false
    },
    {
      id: parentWithoutRepliesId,
      title: `${SEARCH_TERM} parent without replies`,
      slug: `zephyrine-parent-lonely-${parentWithoutRepliesId}`,
      content: 'parent body',
      type: 'micro',
      draft: false
    }
  ])

  await db.insert(postsTable).values(
    [1, 2].map((index) => {
      const id = randomUUID()
      return {
        id,
        title: `reply ${index}`,
        slug: `zephyrine-reply-${id}`,
        content: 'reply body',
        type: 'micro' as const,
        draft: false,
        parentPostId: parentWithRepliesId,
        rootPostId: parentWithRepliesId,
        depth: 1
      }
    })
  )
})

describe('searchMicroPosts reply counts', () => {
  test('reports the direct reply count for a searched tweet that has replies', async () => {
    const result = await runPostEffect((service) =>
      service.searchMicroPosts({ q: SEARCH_TERM, limit: 20, offset: 0 })
    )

    const match = result.data.find((post) => post.id === parentWithRepliesId)

    expect(match).toBeDefined()
    expect(match?.replyCount).toBe(2)
  })

  test('reports zero for a searched tweet with no replies', async () => {
    const result = await runPostEffect((service) =>
      service.searchMicroPosts({ q: SEARCH_TERM, limit: 20, offset: 0 })
    )

    const match = result.data.find((post) => post.id === parentWithoutRepliesId)

    expect(match).toBeDefined()
    expect(match?.replyCount).toBe(0)
  })

  test('returns an empty page without failing when nothing matches', async () => {
    const result = await runPostEffect((service) =>
      service.searchMicroPosts({ q: 'qwyxlbtnvz', limit: 20, offset: 0 })
    )

    expect(result.data).toEqual([])
    expect(result.pagination.total).toBe(0)
  })

  test('returns an empty page when the offset is past the end of the results', async () => {
    const result = await runPostEffect((service) =>
      service.searchMicroPosts({ q: SEARCH_TERM, limit: 20, offset: 500 })
    )

    expect(result.data).toEqual([])
  })
})

describe('getMicroPosts reply counts', () => {
  test('populates reply counts on the tweet listing', async () => {
    const result = await runPostEffect((service) =>
      service.getMicroPosts({ limit: 100, offset: 0 })
    )

    const withReplies = result.data.find((post) => post.id === parentWithRepliesId)
    const withoutReplies = result.data.find((post) => post.id === parentWithoutRepliesId)

    expect(withReplies?.replyCount).toBe(2)
    expect(withoutReplies?.replyCount).toBe(0)
  })
})
