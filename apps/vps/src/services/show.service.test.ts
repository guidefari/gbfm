import { randomUUID } from 'node:crypto'
import { Effect } from 'effect'
import { beforeAll, describe, expect, test } from 'vitest'
import { db } from '@/db'
import { audioCreators, audioTable } from '@/db/audio.schema'
import { user } from '@/db/auth.schema'
import { ShowService, ShowServiceLayer } from './show.service'

const hostId = `show-creators-${randomUUID()}`

const getService = () =>
  Effect.runPromise(
    Effect.gen(function* () {
      return yield* ShowService
    }).pipe(Effect.provide(ShowServiceLayer))
  )

beforeAll(async () => {
  await db.insert(user).values({
    id: hostId,
    name: 'Show host actor',
    email: `${hostId}@example.com`
  })
})

describe('ShowService creators', () => {
  test('getAll attaches hosts and getEpisodes attaches episode creators', async () => {
    const service = await getService()
    const slug = `show-${randomUUID()}`

    const show = await Effect.runPromise(
      service.create(
        {
          title: `Show ${slug}`,
          slug,
          content: ''
        },
        [hostId]
      )
    )

    const episodeSlug = `episode-${randomUUID()}`
    const [episode] = await db
      .insert(audioTable)
      .values({
        title: `Episode ${episodeSlug}`,
        slug: episodeSlug,
        content: '',
        type: 'mix',
        url: 'https://example.com/audio.mp3',
        showId: show.id
      })
      .returning()

    if (!episode) {
      throw new Error('Failed to insert episode fixture')
    }

    await db.insert(audioCreators).values({
      audioId: episode.id,
      creatorId: hostId
    })

    const { data: shows } = await Effect.runPromise(service.getAll({ limit: 100, offset: 0 }))
    const matchedShow = shows.find((s) => s.id === show.id)
    expect(matchedShow?.hosts).toEqual([expect.objectContaining({ id: hostId })])

    const { data: episodes } = await Effect.runPromise(
      service.getEpisodes(slug, { limit: 100, offset: 0 })
    )
    expect(episodes).toHaveLength(1)
    expect(episodes[0]?.creators).toEqual([expect.objectContaining({ id: hostId })])
  })
})
