import { randomUUID } from 'node:crypto'
import { count, eq } from 'drizzle-orm'
import { Effect, Layer } from 'effect'
import { beforeAll, describe, expect, test } from 'vitest'
import { db } from '@/db'
import { audioTable } from '@/db/audio.schema'
import { user } from '@/db/auth.schema'
import { MdxServiceLive } from '@/lib/mdx'
import { AudioService, AudioServiceLive } from './audio.service'

const actorId = `audio-idempotency-${randomUUID()}`

const makeAudio = (slug: string) => ({
  title: `Audio ${slug}`,
  slug,
  content: '',
  type: 'mix' as const,
  url: 'https://example.com/audio.mp3'
})

const getService = () =>
  Effect.runPromise(
    Effect.gen(function* () {
      return yield* AudioService
    }).pipe(Effect.provide(AudioServiceLive.pipe(Layer.provide(MdxServiceLive))))
  )

beforeAll(async () => {
  await db.insert(user).values({
    id: actorId,
    name: 'Audio idempotency actor',
    email: `${actorId}@example.com`
  })
})

describe('AudioService.create idempotency', () => {
  test('replays the original row when a retry uses the same actor and key', async () => {
    const service = await getService()
    const slug = `retry-${randomUUID()}`
    const idempotencyKey = randomUUID()

    const first = await Effect.runPromise(
      service.create(makeAudio(slug), [actorId], { actorId, idempotencyKey })
    )
    const replay = await Effect.runPromise(
      service.create({ ...makeAudio(slug), title: 'Changed retry body' }, [actorId], {
        actorId,
        idempotencyKey
      })
    )

    expect(replay.id).toBe(first.id)
    expect(replay.title).toBe(first.title)
  })

  test('atomically replays one row across concurrent create attempts', async () => {
    const service = await getService()
    const slug = `concurrent-${randomUUID()}`
    const idempotencyKey = randomUUID()

    const results = await Promise.all(
      Array.from({ length: 6 }, () =>
        Effect.runPromise(service.create(makeAudio(slug), [actorId], { actorId, idempotencyKey }))
      )
    )
    const [rowCount] = await db
      .select({ count: count() })
      .from(audioTable)
      .where(eq(audioTable.slug, slug))

    expect(new Set(results.map((audio) => audio.id)).size).toBe(1)
    expect(rowCount?.count).toBe(1)
  })

  test('keeps a natural-key collision with a different key as a conflict', async () => {
    const service = await getService()
    const slug = `conflict-${randomUUID()}`

    await Effect.runPromise(
      service.create(makeAudio(slug), [actorId], {
        actorId,
        idempotencyKey: randomUUID()
      })
    )

    await expect(
      Effect.runPromise(
        service.create(makeAudio(slug), [actorId], {
          actorId,
          idempotencyKey: randomUUID()
        })
      )
    ).rejects.toMatchObject({ _tag: 'ConflictError' })
  })
})
