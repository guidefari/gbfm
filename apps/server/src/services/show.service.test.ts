import { randomUUID } from 'node:crypto'

import { OtelTracer, Resource } from '@effect/opentelemetry'
import { trace } from '@opentelemetry/api'
import { InMemorySpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base'
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node'
import { Effect, Layer } from 'effect'
import { beforeAll, describe, expect, test } from 'vitest'

import { audioCreators, audioTable } from '@/db/audio.schema'
import { user } from '@/db/auth.schema'
import { DatabaseTestLayer, db } from '@/test/database'
import { withTestLayer } from '@/test/effect'

import { ShowService, ShowServiceLayer } from './show.service'

const hostId = `show-creators-${randomUUID()}`

const otherHostId = `show-creators-other-${randomUUID()}`

const getService = () =>
  Effect.runPromise(
    withTestLayer(
      Effect.gen(function* () {
        return yield* ShowService
      }),
      ShowServiceLayer.pipe(Layer.provide(DatabaseTestLayer)),
    ),
  )

beforeAll(async () => {
  await db.insert(user).values([
    {
      id: hostId,
      name: 'Show host actor',
      email: `${hostId}@example.com`,
    },
    {
      id: otherHostId,
      name: 'Other show host actor',
      email: `${otherHostId}@example.com`,
    },
  ])
})

describe('ShowService creators', () => {
  test('getAll and getAllForEdit trace count, list, and labels under their request spans', async () => {
    const exporter = new InMemorySpanExporter()

    const provider = new NodeTracerProvider({
      spanProcessors: [new SimpleSpanProcessor(exporter)],
    })

    provider.register()

    const tracingLive = OtelTracer.layerGlobal.pipe(
      Layer.provide(Resource.layer({ serviceName: 'show-service-test' })),
    )

    try {
      const results = await Effect.runPromise(
        withTestLayer(
          Effect.gen(function* () {
            const service = yield* ShowService

            return yield* Effect.all([
              service.getAll({ limit: 5, offset: 0 }),
              service.getAllForEdit({ limit: 5, offset: 0 }, hostId, 'user'),
            ])
          }),
          Layer.merge(ShowServiceLayer.pipe(Layer.provide(DatabaseTestLayer)), tracingLive),
        ),
      )

      await provider.forceFlush()

      const spans = exporter.getFinishedSpans()

      const parents = spans.filter((span) =>
        ['show.getAll', 'show.getAllForEdit'].includes(span.name),
      )

      expect(parents).toHaveLength(2)

      for (const parent of parents) {
        const result = results[parent.name === 'show.getAll' ? 0 : 1]

        expect(parent.attributes).toMatchObject({
          limit: 5,
          offset: 0,
          resultCount: result?.data.length,
          totalCount: result?.pagination.total,
        })

        for (const name of ['show.getAll.count', 'show.getAll.list', 'show.getAll.labels']) {
          expect(
            spans.filter(
              (span) =>
                span.name === name &&
                span.parentSpanContext?.spanId === parent.spanContext().spanId,
            ),
          ).toHaveLength(1)
        }
      }

      expect(JSON.stringify(spans.map((span) => span.attributes))).not.toContain(hostId)
    } finally {
      await provider.shutdown()
      trace.disable()
    }
  })

  test('getAll attaches hosts and getEpisodes attaches episode creators', async () => {
    const service = await getService()
    const slug = `show-${randomUUID()}`

    const show = await Effect.runPromise(
      service.create(
        {
          title: `Show ${slug}`,
          slug,
          content: '',
        },
        [hostId],
      ),
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
        showId: show.id,
      })
      .returning()

    if (!episode) {
      throw new Error('Failed to insert episode fixture')
    }

    await db.insert(audioCreators).values({
      audioId: episode.id,
      creatorId: hostId,
    })

    const { data: shows } = await Effect.runPromise(service.getAll({ limit: 100, offset: 0 }))
    const matchedShow = shows.find((s) => s.id === show.id)
    expect(matchedShow?.hosts).toEqual([expect.objectContaining({ id: hostId })])

    const { data: episodes } = await Effect.runPromise(
      service.getEpisodes(slug, { limit: 100, offset: 0 }),
    )

    expect(episodes).toHaveLength(1)
    expect(episodes[0]?.creators).toEqual([expect.objectContaining({ id: hostId })])
  })

  test('getAllForEdit returns only the non-admin actor own shows', async () => {
    const service = await getService()
    const ownSlug = `show-own-${randomUUID()}`
    const otherSlug = `show-other-${randomUUID()}`

    const ownShow = await Effect.runPromise(
      service.create({ title: `Show ${ownSlug}`, slug: ownSlug, content: '' }, [hostId]),
    )

    const otherShow = await Effect.runPromise(
      service.create({ title: `Show ${otherSlug}`, slug: otherSlug, content: '' }, [otherHostId]),
    )

    const { data: shows } = await Effect.runPromise(
      service.getAllForEdit({ limit: 100, offset: 0 }, hostId, 'user'),
    )

    const ids = shows.map((s) => s.id)

    expect(ids).toContain(ownShow.id)
    expect(ids).not.toContain(otherShow.id)
  })

  test('getAllForEdit returns every show for an admin actor', async () => {
    const service = await getService()
    const otherSlug = `show-admin-${randomUUID()}`

    const otherShow = await Effect.runPromise(
      service.create({ title: `Show ${otherSlug}`, slug: otherSlug, content: '' }, [otherHostId]),
    )

    const { data: shows } = await Effect.runPromise(
      service.getAllForEdit({ limit: 100, offset: 0 }, hostId, 'admin'),
    )

    expect(shows.map((s) => s.id)).toContain(otherShow.id)
  })

  test('getEpisodes falls back to the show current thumbnailUrl when an episode has none', async () => {
    const service = await getService()
    const slug = `show-thumb-${randomUUID()}`

    const show = await Effect.runPromise(
      service.create(
        {
          title: `Show ${slug}`,
          slug,
          content: '',
          thumbnailUrl: 'https://example.com/show-art.png',
        },
        [hostId],
      ),
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
        showId: show.id,
      })
      .returning()

    if (!episode) {
      throw new Error('Failed to insert episode fixture')
    }

    await db.insert(audioCreators).values({
      audioId: episode.id,
      creatorId: hostId,
    })

    const { data: episodesBefore } = await Effect.runPromise(
      service.getEpisodes(slug, { limit: 100, offset: 0 }),
    )

    expect(episodesBefore.find((e) => e.id === episode.id)?.thumbnailUrl).toBe(
      'https://example.com/show-art.png',
    )

    await Effect.runPromise(
      service.update(slug, hostId, 'admin', {
        thumbnailUrl: 'https://example.com/new-show-art.png',
      }),
    )

    const { data: episodesAfter } = await Effect.runPromise(
      service.getEpisodes(slug, { limit: 100, offset: 0 }),
    )

    expect(episodesAfter.find((e) => e.id === episode.id)?.thumbnailUrl).toBe(
      'https://example.com/new-show-art.png',
    )
  })
})
