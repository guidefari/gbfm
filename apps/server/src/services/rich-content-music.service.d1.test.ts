/* oxlint-disable anti-slop-effect/no-manual-tagged-construction -- Test expectations intentionally spell out schema-owned rich-content wire values. */
import { randomUUID } from 'node:crypto'

import { eq } from 'drizzle-orm'
import { Effect, Layer } from 'effect'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

import {
  musicEntityLinksTable,
  musicEntityTypesTable,
  musicPlatformsTable,
  musicSourceIdentitiesTable,
  musicTracksTable,
} from '@/db/music-entity.schema'
import { MdxService, MdxServiceCatalogLayer } from '@/lib/mdx'
import { DatabaseTestLayer, db } from '@/test/database'
import { withTestLayer } from '@/test/effect'

import { RichContentMusicResolverLayer } from './rich-content-music.service'

const entityId = randomUUID()

const spotifyId = '2Mf7lfHxdiABiO7j0BDbHc'

const spotifyUrl = `https://open.spotify.com/track/${spotifyId}`

const MdxCatalogTestLayer = MdxServiceCatalogLayer.pipe(
  Layer.provide(RichContentMusicResolverLayer.pipe(Layer.provide(DatabaseTestLayer))),
)

beforeAll(async () => {
  await db.batch([
    db
      .insert(musicEntityTypesTable)
      .values({ id: 'track', displayName: 'Track' })
      .onConflictDoNothing(),
    db
      .insert(musicPlatformsTable)
      .values({ id: 'spotify', displayName: 'Spotify' })
      .onConflictDoNothing(),
    db.insert(musicTracksTable).values({
      id: entityId,
      title: 'Grapefruit',
      artistNames: ['Lack'],
      coverImageUrl: `https://cdn.goosebumps.fm/music/${entityId}/cover`,
      slug: `grapefruit-${entityId}`,
    }),
    db.insert(musicEntityLinksTable).values({
      entityType: 'track',
      entityId,
      platform: 'spotify',
      url: spotifyUrl,
      status: 'verified',
    }),
    db.insert(musicSourceIdentitiesTable).values({
      sourceKey: `spotify:track:${spotifyId}`,
      platform: 'spotify',
      sourceEntityType: 'track',
      externalId: spotifyId,
      canonicalUrl: spotifyUrl,
      state: 'resolved',
      entityType: 'track',
      entityId,
      resolvedAt: new Date(),
    }),
  ])
})

afterAll(async () => {
  await db
    .delete(musicSourceIdentitiesTable)
    .where(eq(musicSourceIdentitiesTable.entityId, entityId))
  await db.delete(musicEntityLinksTable).where(eq(musicEntityLinksTable.entityId, entityId))
  await db.delete(musicTracksTable).where(eq(musicTracksTable.id, entityId))
})

const render = (source: string) =>
  Effect.runPromise(
    withTestLayer(
      Effect.gen(function* () {
        const mdx = yield* MdxService

        return yield* mdx.render(source)
      }),
      MdxCatalogTestLayer,
    ),
  )

describe('catalog-backed rich content', () => {
  test('projects a Spotify reference as an existing GBFM music entity', async () => {
    const document = await render(
      `::track{url="${spotifyUrl}" genres="experimental" blurb="Selected cut."}`,
    )

    expect(document.blocks[0]).toEqual({
      _tag: 'MusicEmbed',
      music: {
        entityType: 'track',
        entityId,
        title: 'Grapefruit',
        artists: ['Lack'],
        description: null,
        imageUrl: `https://cdn.goosebumps.fm/music/${entityId}/cover`,
        canonicalUrl: spotifyUrl,
        links: [{ platform: 'spotify', url: spotifyUrl }],
        tracks: [],
      },
      genres: ['experimental'],
      blurb: 'Selected cut.',
      showTracks: true,
    })
  })

  test('degrades an unknown Spotify reference without creating an iframe payload', async () => {
    const unknownUrl = 'https://open.spotify.com/track/0000000000000000000000'
    const document = await render(unknownUrl)

    expect(document.blocks).toEqual([
      {
        _tag: 'UnavailableEmbed',
        kind: 'music',
        label: 'This music embed is unavailable.',
        href: unknownUrl,
      },
    ])
  })
})
