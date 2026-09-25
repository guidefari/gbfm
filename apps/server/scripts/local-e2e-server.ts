import { eq } from 'drizzle-orm'
import { Layer } from 'effect'

import { user } from '@/db/auth.schema'
import { makeDatabaseClient } from '@/db/layer'
import {
  musicEntityLinksTable,
  musicEntityTypesTable,
  musicPlatformsTable,
  musicTracksTable,
} from '@/db/music-entity.schema'
import { postCreators, postsTable } from '@/db/post.schema'
import { seedLocalUsers } from '@/db/seed-local-users'
import { ConfigService, createConfig } from '@/services/config.service'
import { createTestWebHandler } from '@/test/http-handler'
import { createMigratedD1Database } from '@/test/migrate-d1'

const port = Number(process.env.PORT ?? 3003)

const resource = await createMigratedD1Database()

const database = makeDatabaseClient(resource.database)

await seedLocalUsers(database)

const [creator] = await database
  .select({ id: user.id })
  .from(user)
  .where(eq(user.username, 'local-creator'))

if (!creator) throw new Error('Local E2E creator was not seeded')

const rootTrackId = '00000000-0000-4000-8000-000000000001'

const replyTrackId = '00000000-0000-4000-8000-000000000002'

await database.batch([
  database
    .insert(musicEntityTypesTable)
    .values({ id: 'track', displayName: 'Track' })
    .onConflictDoNothing(),
  database
    .insert(musicPlatformsTable)
    .values([
      { id: 'spotify', displayName: 'Spotify' },
      { id: 'bandcamp', displayName: 'Bandcamp' },
    ])
    .onConflictDoNothing(),
  database.insert(musicTracksTable).values([
    {
      id: rootTrackId,
      title: 'Root Frequency',
      slug: 'e2e-root-frequency',
      artistNames: ['Signal Source'],
      coverImageUrl: '/fav.png',
    },
    {
      id: replyTrackId,
      title: 'Reply Frequency',
      slug: 'e2e-reply-frequency',
      artistNames: ['Echo Unit', 'Return Path'],
      coverImageUrl: '/fav.png',
    },
  ]),
])

await database.insert(musicEntityLinksTable).values([
  {
    entityType: 'track',
    entityId: rootTrackId,
    platform: 'spotify',
    url: 'https://open.spotify.com/track/e2e-root',
  },
  {
    entityType: 'track',
    entityId: replyTrackId,
    platform: 'bandcamp',
    url: 'https://example.bandcamp.com/track/e2e-reply',
  },
])

const [rootPost] = await database
  .insert(postsTable)
  .values({
    slug: 'e2e-music-thread',
    content: 'A tweet with a musical reply.',
    type: 'micro',
    draft: false,
    musicEntityType: 'track',
    musicEntityId: rootTrackId,
  })
  .returning()

if (!rootPost) throw new Error('Local E2E tweet was not seeded')

const [replyPost] = await database
  .insert(postsTable)
  .values({
    slug: 'e2e-music-reply',
    content: 'The reply keeps its own soundtrack.',
    type: 'micro',
    draft: false,
    parentPostId: rootPost.id,
    rootPostId: rootPost.id,
    depth: 1,
    musicEntityType: 'track',
    musicEntityId: replyTrackId,
  })
  .returning()

if (!replyPost) throw new Error('Local E2E tweet reply was not seeded')

await database.insert(postCreators).values([
  { postId: rootPost.id, creatorId: creator.id },
  { postId: replyPost.id, creatorId: creator.id },
])

const baseConfig = createConfig()

const configLive = Layer.succeed(ConfigService, {
  ...baseConfig,
  urls: {
    ...baseConfig.urls,
    frontend: process.env.FRONTEND_URL ?? 'http://127.0.0.1:5173',
  },
  auth: {
    ...baseConfig.auth,
    betterAuthSecret: process.env.BETTER_AUTH_SECRET ?? 'local-e2e-secret-at-least-32-characters',
    betterAuthUrl: process.env.BETTER_AUTH_URL ?? `http://127.0.0.1:${port}`,
  },
})

const handler = createTestWebHandler(resource.database, undefined, undefined, undefined, configLive)

const server = Bun.serve({
  hostname: '127.0.0.1',
  port,
  fetch: (request) => handler.handler(request),
})

console.log(`Local E2E API listening on ${server.url}`)

const stop = async () => {
  server.stop(true)
  await handler.dispose()
  await resource.dispose()
  process.exit()
}

process.on('SIGINT', stop)

process.on('SIGTERM', stop)
