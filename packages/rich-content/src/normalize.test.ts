import { describe, expect, test } from 'vitest'

import { normalizeRichContent } from './normalize'

describe('legacy normalization', () => {
  test('preserves prose and is byte-idempotent', () => {
    const source =
      'Before { prose }\n\n<Track url="https://open.spotify.com/track/abc" />\n\n::media{url="https://youtu.be/abc"}\n\nAfter.'

    const first = normalizeRichContent(source)
    const second = normalizeRichContent(first.source)
    expect(first.changed).toBe(true)
    expect(first.source.startsWith('Before { prose }')).toBe(true)
    expect(first.source.endsWith('After.')).toBe(true)
    expect(second).toEqual({ source: first.source, changed: false, unresolved: [] })
  })

  test('does not rewrite component-shaped examples in fenced code', () => {
    const source =
      '```mdx\n<Track url="https://open.spotify.com/track/example" />\n```\n\n<Track url="https://open.spotify.com/track/live" />'

    const result = normalizeRichContent(source)

    expect(result.source).toBe(
      '```mdx\n<Track url="https://open.spotify.com/track/example" />\n```\n\n::track{url="https://open.spotify.com/track/live"}',
    )
    expect(result.unresolved).toEqual([])
  })

  test('converts a card group as one node without rewriting its children twice', () => {
    const source =
      '<HorizontalScrollCards>\n<Track url="https://open.spotify.com/track/abc" />\n<Album url="https://open.spotify.com/album/def" />\n</HorizontalScrollCards>'

    expect(normalizeRichContent(source)).toEqual({
      source:
        ':::cards\n::track{url="https://open.spotify.com/track/abc"}\n::album{url="https://open.spotify.com/album/def"}\n:::',
      changed: true,
      unresolved: [],
    })
  })

  test('unwraps a presentational div around a static media iframe', () => {
    const source =
      '<div style={{ width: "100%" }}>\n<iframe src="https://www.youtube.com/embed/PA85ewEv5Aw" />\n</div>'

    expect(normalizeRichContent(source)).toEqual({
      source: '::media{url="https://www.youtube.com/embed/PA85ewEv5Aw"}',
      changed: true,
      unresolved: [],
    })
  })

  test('reports malformed legacy MDX without changing the source', () => {
    const source = 'A literal opening brace: {'

    expect(normalizeRichContent(source)).toEqual({
      source,
      changed: false,
      unresolved: [{ source, reason: 'Document could not be parsed as legacy MDX' }],
    })
  })
})
