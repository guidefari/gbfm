import { eq } from 'drizzle-orm'
import { Effect } from 'effect'
import type { Context } from 'hono'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import { db } from '@/db'
import { user as usersTable } from '@/db/auth.schema'
import { DatabaseError, NotFoundError } from '@/errors'
import { runApp } from '@/runtime'
import { buildErrorHtml, buildOGHtml } from '../redirect.template'

type HtmlResponse = { html: string; status: ContentfulStatusCode }

const fetchUserByUsername = (username: string) =>
  Effect.tryPromise({
    try: () =>
      db
        .select({
          id: usersTable.id,
          name: usersTable.name,
          username: usersTable.username,
          displayUsername: usersTable.displayUsername,
          image: usersTable.image,
          banned: usersTable.banned
        })
        .from(usersTable)
        .where(eq(usersTable.username, username))
        .limit(1),
    catch: (error) =>
      new DatabaseError({
        message: String(error),
        operation: 'select',
        table: 'user'
      })
  })

export const shareProfile = async (c: Context) => {
  const { username } = c.req.param()

  if (!username) {
    return c.html(
      buildErrorHtml({
        title: 'Invalid URL',
        message: 'The URL is missing a username.',
        statusCode: 400
      }),
      400
    )
  }

  const program = Effect.gen(function* () {
    const [user] = yield* fetchUserByUsername(username)
    if (!user || user.banned) {
      return yield* new NotFoundError({
        message: 'Profile not found',
        resource: 'profile',
        id: username
      })
    }

    const displayName = user.displayUsername || user.username || user.name

    return {
      html: buildOGHtml({
        type: 'profile',
        title: displayName,
        description: `Check out ${displayName}'s profile on goosebumps.fm`,
        image: user.image,
        canonicalPath: `/${user.username}`,
        imageAlt: `${displayName}'s profile picture`
      }),
      status: 200
    } satisfies HtmlResponse
  }).pipe(
    Effect.catchTag('NotFoundError', () =>
      Effect.succeed<HtmlResponse>({
        html: buildErrorHtml({
          title: 'Profile not found',
          message: "The profile you're looking for doesn't exist.",
          statusCode: 404
        }),
        status: 404
      })
    ),
    Effect.catchTag('DatabaseError', (error) =>
      Effect.gen(function* () {
        yield* Effect.logError('[Share] Error fetching profile', {
          username,
          error: error.message
        })
        return {
          html: buildErrorHtml({
            title: 'Error',
            message: 'Something went wrong while loading this profile.',
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
