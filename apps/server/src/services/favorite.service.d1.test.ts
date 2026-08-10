import { and, eq } from 'drizzle-orm'
import { Cause, Effect, Exit, Layer } from 'effect'
import { describe, expect, test } from 'vitest'
import { audioTable } from '@/db/audio.schema'
import { user } from '@/db/auth.schema'
import type { ConflictError, DatabaseError, NotFoundError } from '@/errors'
import { favoritesTable } from '@/db/favorites.schema'
import { Database } from '@/db/layer'
import { showSubscriptionsTable, showsTable } from '@/db/show.schema'
import { db } from '@/test/d1'
import { FavoriteService, FavoriteServiceLayer } from './favorite.service'

const CONCURRENCY = 20

const TestFavoriteServiceLayer = FavoriteServiceLayer.pipe(
  Layer.provide(Layer.succeed(Database)(db))
)

const runFavoriteEffect = <A>(
  fn: (
    svc: FavoriteService
  ) => Effect.Effect<A, DatabaseError | NotFoundError | ConflictError, FavoriteService>
) =>
  Effect.runPromiseExit(
    Effect.gen(function* () {
      const svc = yield* FavoriteService
      return yield* fn(svc)
    }).pipe(Effect.provide(TestFavoriteServiceLayer))
  )

describe('D1 concurrent favorites', () => {
  test('20 concurrent addFavorite calls for the same user+audio create exactly one row', async () => {
    const userId = 'concurrent-favorite-user'
    const audioId = 'concurrent-favorite-audio'

    await db
      .insert(user)
      .values({ id: userId, name: 'Concurrent User', email: `${userId}@test.dev` })
    await db.insert(audioTable).values({
      id: audioId,
      title: 'Concurrent Mix',
      slug: 'concurrent-favorite-mix',
      content: 'test content',
      type: 'mix',
      url: 'https://example.com/concurrent.mp3'
    })

    const exits = await Promise.all(
      Array.from({ length: CONCURRENCY }, () =>
        runFavoriteEffect((svc) => svc.addFavorite(userId, audioId))
      )
    )

    const succeeded = exits.filter(Exit.isSuccess)
    const failed = exits.filter(Exit.isFailure)

    expect(succeeded.length).toBe(1)
    expect(failed.length).toBe(CONCURRENCY - 1)

    for (const exit of failed) {
      expect(Exit.isFailure(exit)).toBe(true)
      if (Exit.isFailure(exit)) {
        expect(Cause.hasDies(exit.cause)).toBe(false)
        const error = Cause.findErrorOption(exit.cause)
        expect(error._tag).toBe('Some')
        if (error._tag === 'Some') {
          expect(error.value._tag).toBe('ConflictError')
        }
      }
    }

    const rows = await db
      .select()
      .from(favoritesTable)
      .where(and(eq(favoritesTable.userId, userId), eq(favoritesTable.audioId, audioId)))
    expect(rows.length).toBe(1)
  })

  test('20 concurrent addShowFavorite calls create exactly one favorite and one subscription', async () => {
    const userId = 'concurrent-show-favorite-user'
    const showId = 'concurrent-show-favorite-show'

    await db
      .insert(user)
      .values({ id: userId, name: 'Concurrent Show User', email: `${userId}@test.dev` })
    await db.insert(showsTable).values({
      id: showId,
      title: 'Concurrent Show',
      slug: 'concurrent-favorite-show',
      content: 'test content'
    })

    const exits = await Promise.all(
      Array.from({ length: CONCURRENCY }, () =>
        runFavoriteEffect((svc) => svc.addShowFavorite(userId, showId))
      )
    )

    const succeeded = exits.filter(Exit.isSuccess)
    const failed = exits.filter(Exit.isFailure)

    expect(succeeded.length).toBe(1)
    expect(failed.length).toBe(CONCURRENCY - 1)

    for (const exit of failed) {
      if (Exit.isFailure(exit)) {
        expect(Cause.hasDies(exit.cause)).toBe(false)
        const error = Cause.findErrorOption(exit.cause)
        expect(error._tag).toBe('Some')
        if (error._tag === 'Some') {
          expect(error.value._tag).toBe('ConflictError')
        }
      }
    }

    const favoriteRows = await db
      .select()
      .from(favoritesTable)
      .where(and(eq(favoritesTable.userId, userId), eq(favoritesTable.showId, showId)))
    expect(favoriteRows.length).toBe(1)

    const subscriptionRows = await db
      .select()
      .from(showSubscriptionsTable)
      .where(
        and(eq(showSubscriptionsTable.userId, userId), eq(showSubscriptionsTable.showId, showId))
      )
    expect(subscriptionRows.length).toBe(1)
  })
})
