import { randomUUID } from 'node:crypto'

import { Effect, Layer } from 'effect'
import { expect, test } from 'vitest'

import { user } from '@/db/auth.schema'
import { showSubscriptionsTable, showsTable } from '@/db/show.schema'
import { DatabaseTestLayer, db } from '@/test/database'
import { withTestLayer } from '@/test/effect'

import { ShowSubscriptionService, ShowSubscriptionServiceLayer } from './show-subscription.service'

test('checks membership for one published show without exposing another user or draft show', async () => {
  const firstUser = randomUUID()
  const secondUser = randomUUID()
  const publishedShow = randomUUID()
  const draftShow = randomUUID()

  await db.insert(user).values([
    { id: firstUser, name: 'First listener', email: `${firstUser}@example.com` },
    { id: secondUser, name: 'Second listener', email: `${secondUser}@example.com` },
  ])
  await db.insert(showsTable).values([
    { id: publishedShow, title: 'Published', slug: publishedShow, content: '' },
    { id: draftShow, title: 'Draft', slug: draftShow, content: '', draft: true },
  ])
  await db.insert(showSubscriptionsTable).values([
    { userId: firstUser, showId: publishedShow },
    { userId: firstUser, showId: draftShow },
  ])

  const results = await Effect.runPromise(
    withTestLayer(
      Effect.gen(function* () {
        const service = yield* ShowSubscriptionService

        return yield* Effect.all([
          service.isSubscribed(firstUser, publishedShow),
          service.isSubscribed(secondUser, publishedShow),
          service.isSubscribed(firstUser, draftShow),
          service.isSubscribed(firstUser, randomUUID()),
        ])
      }),
      ShowSubscriptionServiceLayer.pipe(Layer.provide(DatabaseTestLayer)),
    ),
  )

  expect(results).toEqual([true, false, false, false])
})
