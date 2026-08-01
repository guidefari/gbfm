import { describe, expect, test } from 'vitest'
import { normalizeBlueskyRecord } from './bluesky-importer.service'

const entry = (overrides: Record<string, unknown> = {}) => ({
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
        publicUrl: 'https://bsky.app/profile/did:plc:author/post/3abc'
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

  test('excludes reposts, other authors, and non-music links', () => {
    expect(normalizeBlueskyRecord({ ...entry(), reason: {} }, 'did:plc:author')).toEqual({
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
})
