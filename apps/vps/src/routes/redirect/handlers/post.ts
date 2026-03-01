import { eq } from 'drizzle-orm'
import { Effect } from 'effect'
import type { Context } from 'hono'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import { db } from '@/db'
import { user as usersTable } from '@/db/auth.schema'
import { postCreators, postsTable } from '@/db/post.schema'
import { DatabaseError, NotFoundError } from '@/errors'
import { runApp } from '@/runtime'
import { buildErrorHtml, buildOGHtml } from '../redirect.template'

type HtmlResponse = { html: string; status: ContentfulStatusCode }

const fetchPostBySlug = (slug: string) =>
  Effect.tryPromise({
    try: () =>
      db.select().from(postsTable).where(eq(postsTable.slug, slug)).limit(1),
    catch: (error) =>
      new DatabaseError({
        message: String(error),
        operation: 'select',
        table: 'posts'
      })
  })

const fetchCreators = (postId: string) =>
  Effect.tryPromise({
    try: () =>
      db
        .select({
          id: usersTable.id,
          name: usersTable.name
        })
        .from(postCreators)
        .innerJoin(usersTable, eq(postCreators.creatorId, usersTable.id))
        .where(eq(postCreators.postId, postId)),
    catch: (error) =>
      new DatabaseError({
        message: String(error),
        operation: 'select',
        table: 'post_creators'
      })
  })

export const sharePost = async (c: Context) => {
  const { slug } = c.req.param()

  if (!slug) {
    return c.html(
      buildErrorHtml({
        title: 'Invalid URL',
        message: 'The URL is missing a post slug.',
        statusCode: 400
      }),
      400
    )
  }

  const program = Effect.gen(function* () {
    const [post] = yield* fetchPostBySlug(slug)
    if (!post) {
      return yield* new NotFoundError({
        message: 'Post not found',
        resource: 'post',
        id: slug
      })
    }

    const creators = yield* fetchCreators(post.id)

    const canonicalPath =
      post.type === 'micro' ? `/tweet/${slug}` : `/editorial/${slug}`

    return {
      html: buildOGHtml({
        type: 'article',
        title: post.title || slug,
        description:
          post.description || `Read ${post.title || slug} on goosebumps.fm`,
        image: post.thumbnailUrl,
        canonicalPath,
        creators: creators.map((c) => c.name),
        imageAlt: `${post.title || slug} thumbnail`
      }),
      status: 200
    } satisfies HtmlResponse
  }).pipe(
    Effect.catchTag('NotFoundError', () =>
      Effect.succeed<HtmlResponse>({
        html: buildErrorHtml({
          title: 'Post not found',
          message: "The post you're looking for doesn't exist.",
          statusCode: 404
        }),
        status: 404
      })
    ),
    Effect.catchTag('DatabaseError', (error) =>
      Effect.gen(function* () {
        yield* Effect.logError('[Share] Error fetching post', {
          slug,
          error: error.message
        })
        return {
          html: buildErrorHtml({
            title: 'Error',
            message: 'Something went wrong while loading this post.',
            statusCode: 500
          }),
          status: 500
        } satisfies HtmlResponse
      })
    )
  )

  const response = await runApp(program)

  if (response.status === 200) {
    c.header('Cache-Control', 'public, max-age=3600')
  }

  return c.html(response.html, response.status)
}
