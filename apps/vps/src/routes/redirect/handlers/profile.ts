import { eq } from 'drizzle-orm'
import { Effect } from 'effect'
import type { Context } from 'hono'
import { db } from '@/db'
import { user as usersTable } from '@/db/auth.schema'
import { DatabaseError } from '@/errors'
import { runApp } from '@/runtime'
import { buildErrorHtml, buildOGHtml } from '../redirect.template'

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
      return { found: false } as const
    }
    return { found: true, user } as const
  })

  const result = await runApp(program.pipe(Effect.either))

  if (result._tag === 'Left') {
    Effect.logError('[Share] Error fetching profile', {
      username,
      error:
        result.left instanceof Error ? result.left.message : String(result.left)
    }).pipe(Effect.runPromise)

    return c.html(
      buildErrorHtml({
        title: 'Error',
        message: 'Something went wrong while loading this profile.',
        statusCode: 500
      }),
      500
    )
  }

  const data = result.right
  if (!data.found) {
    return c.html(
      buildErrorHtml({
        title: 'Profile not found',
        message: "The profile you're looking for doesn't exist.",
        statusCode: 404
      }),
      404
    )
  }

  const { user } = data
  const displayName = user.displayUsername || user.username || user.name

  const html = buildOGHtml({
    type: 'profile',
    title: displayName,
    description: `Check out ${displayName}'s profile on goosebumps.fm`,
    image: user.image,
    canonicalPath: `/${user.username}`,
    imageAlt: `${displayName}'s profile picture`
  })

  c.header('Cache-Control', 'public, max-age=3600')
  return c.html(html)
}
