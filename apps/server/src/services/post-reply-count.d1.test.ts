import { randomUUID } from 'node:crypto'
import { Effect, Layer } from 'effect'
import { beforeAll, describe, expect, test } from 'vitest'
import { user } from '@/db/auth.schema'
import { blueskyPostSources } from '@/db/external-account.schema'
import { replaceEntityLabels } from '@/db/labels'
import { postCreators, postsTable } from '@/db/post.schema'
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

describe('post hydration through the service interface', () => {
  const rootId = randomUUID()
  const replyId = randomUUID()
  const emptyId = randomUUID()
  const invalidId = randomUUID()
  const creator = { id: randomUUID(), name: 'Hydration author', username: null }
  const coauthor = { id: randomUUID(), name: 'Coauthor', username: 'hydration-coauthor' }
  const rootSlug = `hydration-${rootId}`
  const replySlug = `hydration-${replyId}`
  const source = {
    authorDid: 'did:plc:hydration',
    authorHandle: 'hydration.example',
    publicUrl: 'https://bsky.app/profile/hydration.example/post/test',
    sourceCreatedAt: new Date('2026-01-01'),
    sourceStatus: 'active' as const,
    locallyEdited: false,
    lastError: null
  }

  beforeAll(async () => {
    await db
      .insert(user)
      .values(
        [creator, coauthor].map((author) => ({ ...author, email: `${author.id}@example.com` }))
      )
    await db.insert(postsTable).values([
      { id: rootId, slug: rootSlug, title: 'Hydration root', content: '**root**', type: 'micro' },
      ...[
        { id: replyId, content: '<Unclosed', type: 'micro' as const },
        { id: emptyId, content: null, type: 'micro' as const },
        { id: invalidId, content: 'editorial body', type: 'post' as const }
      ].map((row, index) => ({
        ...row,
        slug: `hydration-${row.id}`,
        title: `Hydration reply ${index}`,
        parentPostId: rootId,
        rootPostId: rootId,
        depth: 1,
        createdAt: new Date(Date.UTC(2026, 0, index + 2))
      }))
    ])
    await db.insert(postCreators).values([
      { postId: rootId, creatorId: creator.id },
      { postId: replyId, creatorId: creator.id },
      { postId: replyId, creatorId: coauthor.id }
    ])
    await replaceEntityLabels(db, 'post', rootId, { tags: ['root-tag'] })
    await replaceEntityLabels(db, 'post', replyId, {
      tags: ['second', 'first'],
      genres: ['ambient']
    })
    await db.insert(blueskyPostSources).values({
      ...source,
      postId: replyId,
      atUri: `at://did:plc:hydration/app.bsky.feed.post/${replyId}`
    })
  })

  test('list and single reads retain labels, creators, attribution and MDX fallback', async () => {
    const list = await runPostEffect((service) => service.getAll({ limit: 100, offset: 0 }))
    const single = await runPostEffect((service) => service.getBySlug(replySlug))
    const bySlug = await runPostEffect((service) => service.getMicroPostBySlug(replySlug))
    const byId = await runPostEffect((service) => service.getMicroPostById(replyId))
    const listed = list.data.find((post) => post.id === replyId)
    expect(listed).toEqual(single)
    expect(bySlug).toEqual(single)
    expect(byId).toEqual(single)
    expect(single).toMatchObject({
      tags: ['second', 'first'],
      genres: ['ambient'],
      compiledContent: '',
      blueskySource: source
    })
    expect(single.creators).toHaveLength(2)
    expect(single.creators).toEqual(expect.arrayContaining([creator, coauthor]))
    expect(list.data.find((post) => post.id === emptyId)).toMatchObject({
      tags: null,
      genres: null,
      creators: [],
      compiledContent: ''
    })
    expect(list.data.find((post) => post.id === rootId)?.compiledContent).not.toBe('')
  })

  test('search, replies and thread share hydration without changing endpoint refinements', async () => {
    const search = await runPostEffect((service) =>
      service.searchMicroPosts({ q: 'Hydration', limit: 100, offset: 0 })
    )
    const replies = await runPostEffect((service) =>
      service.getMicroPostReplies(rootSlug, { limit: 100, offset: 0 })
    )
    const thread = await runPostEffect((service) =>
      service.getMicroPostThread(replySlug, { limit: 100, offset: 0 })
    )
    const searched = search.data.find((post) => post.id === replyId)
    expect(replies.data[0]).toEqual(searched)
    expect(searched).toMatchObject({
      tags: ['second', 'first'],
      genres: ['ambient'],
      compiledContent: '',
      replyCount: 0
    })
    expect(searched?.creators).toEqual(expect.arrayContaining([creator, coauthor]))
    expect(searched).not.toHaveProperty('blueskySource')
    expect(thread.focus).toEqual(thread.posts[0])
    expect(thread.focus).not.toHaveProperty('replyCount')
    expect({ ...thread.focus, replyCount: 0 }).toEqual(searched)
    expect(thread.root).toMatchObject({ id: rootId, tags: ['root-tag'], creators: [creator] })
    expect(thread.root.compiledContent).not.toBe('')
    expect(replies.data.map((post) => post.id)).toEqual([replyId, emptyId])
    expect(thread.posts.map((post) => post.id)).toEqual([replyId, emptyId])
    expect(replies.pagination.total).toBe(3)
    expect(thread.pagination.total).toBe(3)
  })

  test('thread root/focus overlap and empty pages preserve context and pagination', async () => {
    const thread = await runPostEffect((service) =>
      service.getMicroPostThread(rootSlug, { limit: 20, offset: 100 })
    )
    expect(thread.root).toEqual(thread.focus)
    expect(thread.root.tags).toEqual(['root-tag'])
    expect(thread.posts).toEqual([])
    expect(thread.pagination.total).toBe(3)
    const replies = await runPostEffect((service) =>
      service.getMicroPostReplies(rootSlug, { limit: 20, offset: 100 })
    )
    expect(replies.data).toEqual([])
    expect(replies.pagination.total).toBe(3)
  })

  test('invalid thread focus remains a refinement error rather than being silently dropped', async () => {
    await expect(
      runPostEffect((service) =>
        service.getMicroPostThread(`hydration-${invalidId}`, { limit: 20, offset: 0 })
      )
    ).rejects.toMatchObject({
      _tag: 'DatabaseError',
      operation: 'post_type_refinement',
      message: `Focus post was not a micro post: hydration-${invalidId}`
    })
  })
})
