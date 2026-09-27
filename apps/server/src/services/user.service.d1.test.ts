import { Effect, Layer } from 'effect'
import { expect, test } from 'vitest'

import { audioCreators, audioTable } from '@/db/audio.schema'
import { user } from '@/db/auth.schema'
import { DatabaseLayer, makeDatabaseClient } from '@/db/layer'
import { withTestLayer } from '@/test/effect'
import { createMigratedD1Database } from '@/test/migrate-d1'

import { UserService, UserServiceLayer } from './user.service'

test('residents use D1 counts, sort by published contributions, and exclude drafts and banned accounts', async () => {
  await using resource = await createMigratedD1Database()
  const db = makeDatabaseClient(resource.database)

  const residents = [
    { id: 'zulu', name: 'Zulu', banned: false },
    { id: 'alpha', name: 'Alpha', banned: false },
    { id: 'bravo', name: 'Bravo', banned: false },
    { id: 'draft-only', name: 'Draft only', banned: false },
    { id: 'banned', name: 'Banned', banned: true },
  ]

  await db
    .insert(user)
    .values(residents.map((resident) => ({ ...resident, email: `${resident.id}@example.test` })))

  const contributions = [
    { id: 'zulu-one', creatorId: 'zulu', draft: false },
    { id: 'zulu-two', creatorId: 'zulu', draft: false },
    { id: 'alpha-one', creatorId: 'alpha', draft: false },
    { id: 'alpha-draft', creatorId: 'alpha', draft: true },
    { id: 'bravo-one', creatorId: 'bravo', draft: false },
    { id: 'draft-only-one', creatorId: 'draft-only', draft: true },
    { id: 'banned-one', creatorId: 'banned', draft: false },
  ]

  await db.insert(audioTable).values(
    contributions.map(({ id, draft }) => ({
      id,
      slug: id,
      title: id,
      type: 'mix' as const,
      content: '',
      draft,
      url: 'https://example.test/audio.mp3',
    })),
  )
  await db
    .insert(audioCreators)
    .values(contributions.map(({ id, creatorId }) => ({ audioId: id, creatorId })))

  const rows = await Effect.runPromise(
    withTestLayer(
      Effect.flatMap(UserService, (service) => service.listDjs()),
      UserServiceLayer.pipe(Layer.provide(DatabaseLayer(resource.database))),
    ),
  )

  expect(rows.map(({ id, mixCount }) => ({ id, mixCount }))).toEqual([
    { id: 'zulu', mixCount: 2 },
    { id: 'alpha', mixCount: 1 },
    { id: 'bravo', mixCount: 1 },
  ])
})
