import type { AudioPagePrincipal } from '@gbfm/api/audio'
import { ShowPageResponse } from '@gbfm/api/shows'
import { drizzle } from 'drizzle-orm/d1'
import { Cause, Deferred, Effect, Exit, Layer } from 'effect'
import { beforeAll, describe, expect, test } from 'vitest'

import { audioTable } from '@/db/audio.schema'
import { user } from '@/db/auth.schema'
import * as schema from '@/db/exports'
import { Database } from '@/db/layer'
import { showsTable } from '@/db/show.schema'
import { DatabaseError } from '@/errors'
import { MdxServiceLayer } from '@/lib/mdx'
import { DatabaseTestLayer, db, d1 } from '@/test/database'
import { withTestLayer } from '@/test/effect'

import { ConfigService, ConfigServiceLayer } from './config.service'
import { loadShowPage } from './show-page'
import {
  ShowService,
  ShowServiceLayer,
  ShowSubscriptionService,
  ShowSubscriptionServiceLayer,
} from './show.service'

const slug = 'show-page-service'

const principal: AudioPagePrincipal = {
  id: 'show-page-service-listener',
  name: 'Listener',
  username: null,
  image: null,
  role: 'user',
}

const services = Layer.mergeAll(
  ShowServiceLayer.pipe(Layer.provide(MdxServiceLayer), Layer.provide(DatabaseTestLayer)),
  ShowSubscriptionServiceLayer.pipe(Layer.provide(DatabaseTestLayer)),
  ConfigServiceLayer,
)

const failure = () =>
  new DatabaseError({ message: 'Fixture read unavailable', operation: 'select', table: 'shows' })

beforeAll(async () => {
  await db
    .insert(user)
    .values({ id: principal.id, name: 'Listener', email: 'show-page-service@example.com' })
  await db.insert(showsTable).values({ id: slug, slug, title: 'Service show fixture', content: '' })
})

describe('Show page composition read ownership and failure boundaries', () => {
  test('the page executes one detail read, direct-ID episodes and a dial without a count query', async () => {
    await db.insert(audioTable).values({
      id: 'show-page-query-episode',
      slug: 'show-page-query-episode',
      title: 'Query fixture',
      type: 'mix',
      content: '',
      url: 'https://example.com/query.mp3',
      showId: slug,
    })

    const queries: Array<{ sql: string; params: Array<unknown> }> = []

    const database = drizzle(d1, {
      schema,
      logger: {
        logQuery: (sql, params) => {
          queries.push({ sql, params })
        },
      },
    })

    const databaseLayer = Layer.succeed(Database, database)

    const trackedServices = Layer.mergeAll(
      ShowServiceLayer.pipe(Layer.provide(MdxServiceLayer), Layer.provide(databaseLayer)),
      ShowSubscriptionServiceLayer.pipe(Layer.provide(databaseLayer)),
      ConfigServiceLayer,
    )

    const page = await Effect.runPromise(
      withTestLayer(loadShowPage(slug, principal), trackedServices),
    )

    expect(ShowPageResponse.guards.Ready(page)).toBe(true)
    expect(queries.filter(({ sql }) => sql.includes('"showsTable"."slug" = ?'))).toHaveLength(1)
    expect(queries.some(({ sql }) => sql.includes('count(*) from "shows"'))).toBe(false)
    expect(queries.filter(({ sql }) => sql.includes('"audioTable"."showId" = ?'))).toHaveLength(1)
    expect(
      queries.filter(({ sql }) => sql.includes('from "audio"') && sql.includes('count(*)')),
    ).toHaveLength(1)
    expect(queries).toHaveLength(8)
  })

  test('content failure returns unavailable and retains the resolved principal', async () => {
    const page = await Effect.runPromise(
      withTestLayer(
        Effect.gen(function* () {
          const shows = yield* ShowService

          return yield* loadShowPage(slug, principal).pipe(
            Effect.provideService(ShowService, {
              ...shows,
              getBySlug: () => Effect.fail(failure()),
            }),
          )
        }),
        services,
      ),
    )

    expect(page).toEqual(ShowPageResponse.cases.Unavailable.make({ principal }))
  })

  test('episode, sidebar and subscription failures do not suppress available content', async () => {
    const page = await Effect.runPromise(
      withTestLayer(
        Effect.gen(function* () {
          const shows = yield* ShowService
          const subscriptions = yield* ShowSubscriptionService

          return yield* loadShowPage(slug, principal).pipe(
            Effect.provideService(ShowService, {
              ...shows,
              getNavigationShows: Effect.fail(failure()),
              getEpisodesForShow: () => Effect.fail(failure()),
            }),
            Effect.provideService(ShowSubscriptionService, {
              ...subscriptions,
              isSubscribed: () => Effect.fail(failure()),
            }),
          )
        }),
        services,
      ),
    )

    if (!ShowPageResponse.guards.Ready(page)) throw new Error('Expected ready page')
    expect(page.show.slug).toBe(slug)
    expect(page.episodes).toBeNull()
    expect(page.shows).toEqual([])
    expect(page.subscription).toBe('unavailable')
  })

  test('metadata failure leaves content available', async () => {
    const page = await Effect.runPromise(
      withTestLayer(
        Effect.gen(function* () {
          const config = yield* ConfigService

          return yield* loadShowPage(slug, principal).pipe(
            Effect.provideService(ConfigService, {
              ...config,
              urls: {
                ...config.urls,
                get frontend(): string {
                  throw new Error('Fixture metadata unavailable')
                },
              },
            }),
          )
        }),
        services,
      ),
    )

    if (!ShowPageResponse.guards.Ready(page)) throw new Error('Expected ready page')
    expect(page.metadata).toBeNull()
    expect(page.show.slug).toBe(slug)
  })

  test('one show read owns metadata and the episode dependency; anonymous reads skip subscription state', async () => {
    const reads: Array<string> = []
    const episodeShows: Array<string> = []
    const memberships: Array<string> = []

    const page = await Effect.runPromise(
      withTestLayer(
        Effect.gen(function* () {
          const shows = yield* ShowService
          const subscriptions = yield* ShowSubscriptionService

          return yield* loadShowPage(slug, null).pipe(
            Effect.provideService(ShowService, {
              ...shows,
              getBySlug: (slug) => {
                reads.push(slug)

                return shows.getBySlug(slug)
              },
              getEpisodes: () => Effect.die('Must not reload show by slug for episodes'),
              getEpisodesForShow: (show, options, actor) => {
                episodeShows.push(show.id)

                return shows.getEpisodesForShow(show, options, actor)
              },
            }),
            Effect.provideService(ShowSubscriptionService, {
              ...subscriptions,
              isSubscribed: (userId, showId) => {
                memberships.push(showId)

                return subscriptions.isSubscribed(userId, showId)
              },
            }),
          )
        }),
        services,
      ),
    )

    expect(ShowPageResponse.guards.Ready(page)).toBe(true)
    expect(reads).toEqual([slug])
    expect(episodeShows).toEqual([slug])
    expect(memberships).toEqual([])
  })

  test('episodes and subscription start concurrently after the loaded show is available', async () => {
    const page = await Effect.runPromise(
      withTestLayer(
        Effect.gen(function* () {
          const shows = yield* ShowService
          const subscriptions = yield* ShowSubscriptionService
          const episodesStarted = yield* Deferred.make<void>()
          const subscriptionStarted = yield* Deferred.make<void>()

          return yield* loadShowPage(slug, principal).pipe(
            Effect.provideService(ShowService, {
              ...shows,
              getEpisodesForShow: (show, options, actor) =>
                Effect.gen(function* () {
                  expect(show.id).toBe(slug)
                  yield* Deferred.succeed(episodesStarted, undefined)
                  yield* Deferred.await(subscriptionStarted)

                  return yield* shows.getEpisodesForShow(show, options, actor)
                }),
            }),
            Effect.provideService(ShowSubscriptionService, {
              ...subscriptions,
              isSubscribed: (userId, showId) =>
                Effect.gen(function* () {
                  expect(showId).toBe(slug)
                  yield* Deferred.succeed(subscriptionStarted, undefined)
                  yield* Deferred.await(episodesStarted)

                  return yield* subscriptions.isSubscribed(userId, showId)
                }),
            }),
          )
        }),
        services,
      ),
    )

    expect(ShowPageResponse.guards.Ready(page)).toBe(true)
  })

  test('interruption is not flattened to an unavailable page', async () => {
    const result = await Effect.runPromiseExit(
      withTestLayer(
        Effect.gen(function* () {
          const shows = yield* ShowService

          return yield* loadShowPage(slug, principal).pipe(
            Effect.provideService(ShowService, { ...shows, getBySlug: () => Effect.interrupt }),
          )
        }),
        services,
      ),
    )

    if (!Exit.isFailure(result)) throw new Error('Expected interrupted read')
    expect(Cause.hasInterrupts(result.cause)).toBe(true)
  })
})
