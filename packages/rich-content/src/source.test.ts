/* oxlint-disable anti-slop-effect/no-manual-tagged-construction -- Structural expectations intentionally describe the public tagged result. */
import { Effect, Exit, Schema } from 'effect'
import { describe, expect, test } from 'vitest'

import { SafeUrl } from './schema'
import { parseRichContent, safeUrl, validateForWrite } from './source'

describe('canonical rich content source', () => {
  test('preserves asymmetric GFM structure', () => {
    const result = parseRichContent(
      '## *Hello*\n\n3. first\n   - nested\n\n![cover](/cover.jpg)\n\n| A | B |\n| :- | -: |\n| x | y |',
    )

    expect(result.diagnostics).toEqual([])
    expect(result.document.blocks.map((block) => block._tag)).toEqual([
      'Heading',
      'List',
      'Paragraph',
      'Table',
    ])
    expect(result.document.blocks[1]).toMatchObject({
      _tag: 'List',
      ordered: true,
      start: 3,
      items: [{ children: [{ _tag: 'Paragraph' }, { _tag: 'List', ordered: false }] }],
    })
    expect(result.document.blocks[2]).toMatchObject({
      _tag: 'Paragraph',
      children: [{ _tag: 'Image', src: '/cover.jpg', alt: 'cover' }],
    })
    expect(result.document.blocks[3]).toMatchObject({ _tag: 'Table', align: ['left', 'right'] })
  })

  test('keeps unsafe authored input inert while preserving ordinary prose', () => {
    const result = parseRichContent(
      '<script>alert(1)</script>\n\n[bad](javascript:alert(1)) and ![vector](data:image/svg+xml,x)\n\nA {brace} and 2 < 3.',
    )

    expect(result.document.blocks[0]).toMatchObject({ _tag: 'Unsupported', reason: 'raw-html' })
    expect(JSON.stringify(result.document)).not.toContain('javascript:')
    expect(JSON.stringify(result.document)).not.toContain('data:image')
    expect(result.document.blocks.at(-1)).toMatchObject({
      _tag: 'Paragraph',
      children: [{ value: 'A {brace} and 2 < 3.' }],
    })
  })

  test('promotes only standalone provider URLs and normalizes directive options', () => {
    const url = 'https://open.spotify.com/track/abc'

    const result = parseRichContent(
      `${url}\n\nListen to [this](${url}).\n\n::track{url="${url}" genres=" dnb, experimental, dnb " tracks="false"}`,
    )

    expect(result.document.blocks[0]).toMatchObject({
      _tag: 'EmbedReference',
      reference: { _tag: 'MusicUrl', entityType: 'track' },
    })
    expect(result.document.blocks[1]).toMatchObject({
      _tag: 'Paragraph',
      children: [{ value: 'Listen to ' }, { _tag: 'Link' }, { value: '.' }],
    })
    expect(result.document.blocks[2]).toMatchObject({
      reference: { genres: ['dnb', 'experimental'], showTracks: false },
    })
  })

  test('uses purpose-specific URL rules and strict write validation', async () => {
    expect(safeUrl('mailto:hello@example.com', 'link')).toBe('mailto:hello@example.com')
    expect(safeUrl('mailto:hello@example.com', 'image')).toBeNull()
    expect(safeUrl('https://user@example.com/x', 'link')).toBeNull()
    expect(safeUrl('https://example.com:444/x', 'link')).toBeNull()
    expect(Schema.decodeUnknownResult(SafeUrl)('javascript:alert(1)')._tag).toBe('Failure')
    expect(Schema.decodeUnknownResult(SafeUrl)('/safe/path')._tag).toBe('Success')
    expect(Exit.isFailure(await Effect.runPromiseExit(validateForWrite('::unknown{x="y"}')))).toBe(
      true,
    )
    expect(
      Exit.isSuccess(await Effect.runPromiseExit(validateForWrite('ordinary { prose < text'))),
    ).toBe(true)
  })

  test('preserves rejected directive source as inert text', () => {
    const source = '::unknown{x="y"}'

    expect(parseRichContent(source).document.blocks).toEqual([
      { _tag: 'Unsupported', source, reason: 'unknown-directive' },
    ])
  })
})
