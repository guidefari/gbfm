import { Effect, Exit } from 'effect'
import { expect, test } from 'vitest'

import { catalogPayload } from './catalog'
import { endpointFor, init, initialModel, Message, update } from './model'

test('catalog routes preserve the selected entity type and restrict dynamic editor routes to admins', () => {
  expect(endpointFor('music', new URLSearchParams({ tab: 'labels' }))).toBe(
    '/api/music/labels/manage',
  )
  expect(endpointFor('music', new URLSearchParams({ tab: '../users' }))).toBe('/api/music/artists')
  expect(endpointFor('music-entity/track/some-id')).toBe('/api/music/tracks/some-id')
  const denied = init('music-entity/track/some-id', { id: 'listener', role: 'user' })()
  expect(denied.commands).toBeUndefined()
  expect(update(denied.model, Message.SaveCatalogEntity()).commands).toBeUndefined()
})

test('entity forms send owned fields only, parse ordered lists/numbers, and distinguish clearing from omission', async () => {
  const encoded = await Effect.runPromise(
    catalogPayload('track', {
      title: ' Track ',
      slug: 'track',
      artistNames: 'Second, First',
      trackNumber: '7',
      albumId: '',
      publishedAt: '',
      createdById: 'forged-owner',
    }),
  )

  expect(JSON.parse(encoded)).toEqual({
    title: 'Track',
    slug: 'track',
    artistNames: ['Second', 'First'],
    trackNumber: 7,
    albumId: null,
    coverImageUrl: null,
    publishedAt: null,
  })
  expect(
    Exit.isFailure(
      await Effect.runPromiseExit(catalogPayload('track', { trackNumber: 'not a number' })),
    ),
  ).toBe(true)

  const artist = JSON.parse(
    await Effect.runPromise(
      catalogPayload('artist', { name: 'Artist', slug: 'artist', genres: '' }),
    ),
  )

  expect(artist).toEqual({
    name: 'Artist',
    slug: 'artist',
    bio: '',
    imageUrl: '',
    genres: [],
    publishedAt: '',
  })
})

test('starting a catalog mutation invalidates earlier link reads without discarding unsaved metadata', () => {
  const model = {
    ...initialModel('music-entity/album/album-id', { id: 'admin', role: 'admin' }),
    phase: 'ready' as const,
    fields: { id: 'album-id', title: 'An unsaved title', linkUrl: 'https://example.com' },
    catalogRevision: 4,
  }

  const writing = update(model, Message.AddCatalogLink()).model
  expect(writing.catalogRevision).toBe(5)

  const stale = Message.CatalogLinksLoaded({
    revision: 4,
    rows: [{ id: 'old', title: 'old', detail: '', href: null, actionId: null }],
  })

  expect(update(writing, stale).model).toEqual(writing)
  const result = update(writing, Message.CatalogCompleted({ operation: 'add-link' }))
  expect(result.model.fields.title).toBe('An unsaved title')
  expect(result.commands?.[0]).toMatchObject({
    name: 'Catalog.LoadLinks',
    args: { revision: 5, id: 'album-id', kind: 'album' },
  })
})
