import { Effect } from 'effect'
import { describe, expect, test } from 'vitest'
import { parseMusicEntityMarkdownEffect, serializeMusicEntity } from './music-entity-markdown'

describe('serializeMusicEntity', () => {
  test('serializes the stable MDX representation', () => {
    expect(serializeMusicEntity({ type: 'album', id: 'album-123' })).toBe(
      '<MusicEntity type="album" id="album-123" />'
    )
  })

  test('escapes entity IDs for a JSX attribute', () => {
    expect(serializeMusicEntity({ type: 'track', id: 'a&b"c' })).toBe(
      '<MusicEntity type="track" id="a&amp;b&quot;c" />'
    )
  })
})

describe('parseMusicEntityMarkdownEffect', () => {
  test('parses a stable music entity reference', () => {
    expect(
      Effect.runSync(parseMusicEntityMarkdownEffect('<MusicEntity type="album" id="album-id" />'))
    ).toEqual({ type: 'album', id: 'album-id' })
  })

  test('rejects unsupported entity types', () => {
    const result = Effect.runSync(
      Effect.option(parseMusicEntityMarkdownEffect('<MusicEntity type="artist" id="artist-id" />'))
    )

    expect(result._tag).toBe('None')
  })
})
