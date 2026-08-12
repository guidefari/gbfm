import { Effect } from 'effect'
import { describe, expect, test } from 'vitest'
import {
  BlueskyImportService,
  BlueskyImportServiceLayer,
  normalizeBlueskyRecord
} from './bluesky-importer.service'

type EntryOverrides = { readonly reason?: Record<never, never> }

const entry = (overrides: EntryOverrides = {}) => ({
  post: {
    uri: 'at://did:plc:author/app.bsky.feed.post/3abc',
    cid: 'bafy-cid',
    author: { did: 'did:plc:author', handle: 'author.bsky.social' },
    record: {
      text: 'listen here',
      createdAt: '2026-01-01T12:00:00.000Z',
      facets: [
        {
          index: { byteStart: 7, byteEnd: 11 },
          features: [
            { $type: 'app.bsky.richtext.facet#link', uri: 'https://open.spotify.com/track/123' }
          ]
        }
      ]
    }
  },
  ...overrides
})

describe('normalizeBlueskyRecord', () => {
  test('extracts facet links and rewrites truncated display text', () => {
    const result = normalizeBlueskyRecord(entry(), 'did:plc:author')

    expect(result).toEqual({
      kind: 'import',
      record: expect.objectContaining({
        candidateUrls: ['https://open.spotify.com/track/123'],
        normalizedContent: 'listen https://open.spotify.com/track/123',
        publicUrl: 'https://bsky.app/profile/did:plc:author/post/3abc',
        sourceCreatedAt: new Date('2026-01-01T12:00:00.000Z')
      })
    })
  })

  test('accepts a linkless #gbfm post', () => {
    const input = entry()
    input.post.record.text = 'thread opener #gbfm'
    input.post.record.facets = [
      {
        index: { byteStart: 15, byteEnd: 20 },
        features: [
          Object.assign({ $type: 'app.bsky.richtext.facet#tag', uri: '' }, { tag: 'gbfm' })
        ]
      }
    ]

    const result = normalizeBlueskyRecord(input, 'did:plc:author')
    expect(result).toMatchObject({ kind: 'import', record: { candidateUrls: [], tags: ['gbfm'] } })
  })

  test('summarizes a feed through the Effect service boundary', async () => {
    const summary = await Effect.runPromise(
      Effect.gen(function* () {
        const importer = yield* BlueskyImportService
        return yield* importer.normalizeFeed(
          [entry(), { ...entry(), reason: {} }],
          'did:plc:author'
        )
      }).pipe(Effect.provide(BlueskyImportServiceLayer))
    )

    expect(summary).toMatchObject({
      discovered: 2,
      qualifying: 1,
      skipped: { repost: 1 }
    })
  })

  test('excludes reposts, other authors, and non-music links', () => {
    expect(normalizeBlueskyRecord({ ...entry(), reason: {} }, 'did:plc:author')).toEqual({
      kind: 'skip',
      reason: 'repost'
    })
    expect(normalizeBlueskyRecord({ reason: {} }, 'did:plc:author')).toEqual({
      kind: 'skip',
      reason: 'repost'
    })
    expect(normalizeBlueskyRecord(entry(), 'did:plc:other')).toEqual({
      kind: 'skip',
      reason: 'different-author'
    })

    const nonMusic = entry()
    nonMusic.post.record.facets = [
      {
        index: { byteStart: 0, byteEnd: 4 },
        features: [{ $type: 'app.bsky.richtext.facet#link', uri: 'https://example.com' }]
      }
    ]
    expect(normalizeBlueskyRecord(nonMusic, 'did:plc:author')).toEqual({
      kind: 'skip',
      reason: 'not-qualifying'
    })
  })

  test('ignores malformed optional facets and embeds', () => {
    const valid = entry()
    const input = {
      ...valid,
      post: {
        ...valid.post,
        record: {
          ...valid.post.record,
          facets: [
            ...valid.post.record.facets,
            { index: { byteStart: 0, byteEnd: 1 }, features: [null] }
          ],
          embed: { $type: 'app.bsky.embed.external' }
        }
      }
    }

    expect(normalizeBlueskyRecord(input, 'did:plc:author')).toMatchObject({
      kind: 'import',
      record: { candidateUrls: ['https://open.spotify.com/track/123'] }
    })
  })
})
