import { randomUUID } from 'node:crypto'

import { Effect, Layer } from 'effect'
import { beforeAll, describe, expect, test } from 'vitest'

import { postsTable } from '@/db/post.schema'
import { MdxServiceLayer } from '@/lib/mdx'
import { ConfigServiceLayer } from '@/services/config.service'
import { UploadAssetServiceLayer } from '@/services/upload-asset.service'
import { DatabaseTestLayer, db } from '@/test/database'
import { withTestLayer } from '@/test/effect'

import { PostService, PostServiceLayer } from './post.service'

const publishedId = randomUUID()

const TestPostServiceLayer = PostServiceLayer.pipe(
  Layer.provide(MdxServiceLayer),
  Layer.provide(Layer.mergeAll(ConfigServiceLayer, UploadAssetServiceLayer)),
  Layer.provide(DatabaseTestLayer),
)

beforeAll(async () => {
  await db.insert(postsTable).values([
    {
      id: publishedId,
      slug: 'latest-published-tweet',
      type: 'micro',
      draft: false,
      createdAt: new Date('2040-01-01T00:00:00Z'),
    },
    {
      id: randomUUID(),
      slug: 'newer-draft-tweet',
      type: 'micro',
      draft: true,
      createdAt: new Date('2040-01-02T00:00:00Z'),
    },
    {
      id: randomUUID(),
      slug: 'newer-editorial',
      type: 'post',
      draft: false,
      createdAt: new Date('2040-01-03T00:00:00Z'),
    },
    {
      id: randomUUID(),
      slug: 'newer-reply',
      type: 'micro',
      draft: false,
      parentPostId: publishedId,
      rootPostId: publishedId,
      depth: 1,
      createdAt: new Date('2040-01-04T00:00:00Z'),
    },
  ])
})

describe('getLatestMicroPost', () => {
  test('returns the latest published top-level tweet', async () => {
    const result = await Effect.runPromise(
      withTestLayer(
        Effect.gen(function* () {
          const posts = yield* PostService

          return yield* posts.getLatestMicroPost
        }),
        TestPostServiceLayer,
      ),
    )

    expect(result).toEqual({ slug: 'latest-published-tweet' })
  })
})
