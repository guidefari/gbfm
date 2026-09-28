import { eq } from 'drizzle-orm'
import { Layer } from 'effect'

import { audioCreators, audioTable } from '@/db/audio.schema'
import { user } from '@/db/auth.schema'
import { replaceEntityLabels } from '@/db/labels'
import { makeDatabaseClient } from '@/db/layer'
import { musicEntityLinksTable, musicLabelsTable, musicTracksTable } from '@/db/music-entity.schema'
import { postCreators, postsTable } from '@/db/post.schema'
import { releasesTable } from '@/db/release.schema'
import { seedLocalUsers } from '@/db/seed-local-users'
import { seedMusicLookups } from '@/db/seed-music-lookups'
import { showCreators, showsTable } from '@/db/show.schema'
import { ConfigService, createConfig } from '@/services/config.service'
import { createTestWebHandler } from '@/test/http-handler'
import { createMigratedD1Database } from '@/test/migrate-d1'

const port = Number(process.env.PORT ?? 3003)

const resource = await createMigratedD1Database()

const database = makeDatabaseClient(resource.database)

await seedLocalUsers(database)
await seedMusicLookups(database)

const [creator] = await database
  .select({ id: user.id })
  .from(user)
  .where(eq(user.username, 'local-creator'))

if (!creator) throw new Error('Local E2E creator was not seeded')

const [show] = await database
  .insert(showsTable)
  .values({
    title: 'Local Radio',
    slug: 'e2e-local-radio',
    description: 'Independent frequencies from our local resident.',
    content: 'A disposable show for browser tests.',
    draft: false,
  })
  .returning()
if (!show) throw new Error('Local E2E show was not seeded')
await database.insert(showCreators).values({ showId: show.id, creatorId: creator.id })
await database.insert(showsTable).values({
  title: 'Quiet Hours',
  slug: 'e2e-quiet-hours',
  content: 'A show without episodes.',
  draft: false,
})

const [mix] = await database
  .insert(audioTable)
  .values({
    type: 'mix',
    title: 'Local Frequencies',
    slug: 'e2e-local-frequencies',
    description: 'A disposable audio fixture for playback and navigation tests.',
    content:
      '## Listening notes\n\nAn **independent signal** with *room to breathe*. [Read more](https://example.com/music).\n\n1. Tune in\n2. Let it drift\n   - Keep the signal local\n\n| Frequency | Mood |\n| :-- | --: |\n| 88.3 FM | Open |\n\nhttps://soundcloud.com/gbfm/local-frequencies',
    showId: show.id,
    url: `http://127.0.0.1:${port}/api/e2e-audio.wav`,
    draft: false,
  })
  .returning()

if (!mix) throw new Error('Local E2E mix was not seeded')
await database.insert(audioCreators).values({ audioId: mix.id, creatorId: creator.id })

// Thirty seconds of quiet PCM audio, served only by this disposable test server.
const audio = new Uint8Array(44 + 8_000 * 30 * 2)
const wav = new DataView(audio.buffer)
const marker = (offset: number, value: string) => audio.set(new TextEncoder().encode(value), offset)
marker(0, 'RIFF')
wav.setUint32(4, audio.length - 8, true)
marker(8, 'WAVEfmt ')
wav.setUint32(16, 16, true)
wav.setUint16(20, 1, true)
wav.setUint16(22, 1, true)
wav.setUint32(24, 8_000, true)
wav.setUint32(28, 16_000, true)
wav.setUint16(32, 2, true)
wav.setUint16(34, 16, true)
marker(36, 'data')
wav.setUint32(40, audio.length - 44, true)

const rootTrackId = '00000000-0000-4000-8000-000000000001'

const replyTrackId = '00000000-0000-4000-8000-000000000002'

await database.batch([
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

const [editorial] = await database
  .insert(postsTable)
  .values({
    slug: 'e2e-listening-notes',
    title: 'Local listening notes',
    content: 'An editorial about independent music.',
    type: 'post',
    draft: false,
  })
  .returning()

if (!editorial) throw new Error('Local E2E editorial was not seeded')

for (const post of [rootPost, editorial]) {
  await replaceEntityLabels(database, 'post', post.id, { tags: ['local-music'] })
}

const labelId = crypto.randomUUID()
await database.insert(musicLabelsTable).values({
  id: labelId,
  name: 'Local Records',
  slug: 'e2e-local-records',
  publishedAt: new Date('2020-01-01T00:00:00Z'),
})
await database.insert(releasesTable).values({
  labelId,
  title: 'Local Signals EP',
  slug: 'e2e-local-signals',
  content: 'Independent signals from Local Records.',
  draft: false,
  releaseDate: new Date('2020-05-14T12:00:00Z'),
  streamingLinks: [{ platform: 'Bandcamp', url: 'https://example.bandcamp.com/album/signals' }],
})

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

const archivePosts = await database
  .insert(postsTable)
  .values([
    {
      slug: 'e2e-archive-one',
      content: 'The first archived signal.',
      type: 'micro',
      draft: false,
      createdAt: new Date('2020-01-01T12:00:00Z'),
    },
    {
      slug: 'e2e-archive-two',
      content: 'The second archived signal.',
      type: 'micro',
      draft: false,
      createdAt: new Date('2020-02-01T12:00:00Z'),
    },
  ])
  .returning()
await database
  .insert(postCreators)
  .values(archivePosts.map((post) => ({ postId: post.id, creatorId: creator.id })))

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
  fetch: (request) =>
    new URL(request.url).pathname === '/api/e2e-audio.wav'
      ? new Response(audio, { headers: { 'content-type': 'audio/wav' } })
      : handler.handler(request),
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
