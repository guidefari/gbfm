import { describe, expect, test } from 'vitest'
import { serializeMusicEntity } from './music-entity-markdown'

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
