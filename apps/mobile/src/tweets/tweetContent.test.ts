import { CompiledMicroPostResponse } from '@gbfm/api/post'
import { Match, Schema } from 'effect'
import { expect, test } from 'vitest'

import fixture from './inline-content.fixture.json'
import { containsMusic, keyedContent, splitInlineImages, tweetLinkUrl } from './tweetContent'

const document = Schema.decodeUnknownSync(CompiledMicroPostResponse.fields.richContent)(fixture)

if (!document) throw new Error('Missing rich tweet fixture')

test('keeps images between their surrounding text, including inside formatted spans', () => {
  const paragraph = document.blocks[0]

  if (!paragraph) throw new Error('Missing paragraph fixture')

  const sections = Match.value(paragraph).pipe(
    Match.tag('Paragraph', ({ children }) => splitInlineImages(children)),
    Match.orElse(() => []),
  )

  expect(sections.map((section) => section.type)).toEqual(['text', 'image', 'text'])
  expect(JSON.stringify(sections[0])).toContain('Before the artwork')
  expect(JSON.stringify(sections[0])).not.toContain('After the artwork')
  expect(JSON.stringify(sections[1])).toContain('Record sleeve')
  expect(JSON.stringify(sections[2])).toContain('After the artwork')
})

test('finds music inside card groups so the linked attachment is not rendered twice', () => {
  expect(containsMusic(document.blocks, 'album-1')).toBe(true)
  expect(containsMusic(document.blocks, 'album-2')).toBe(false)
})

test('keeps keys unique when repeated cards or spans have identical content', () => {
  const keys = keyedContent(['same', 'same', 'different']).map(({ key }) => key)

  expect(new Set(keys).size).toBe(3)
})

test('resolves site links for native external navigation', () => {
  expect(tweetLinkUrl('/shows')).toBe('https://goosebumps.fm/shows')
  expect(tweetLinkUrl('https://example.com/music')).toBe('https://example.com/music')
  expect(tweetLinkUrl('mailto:listener@example.com')).toBe('mailto:listener@example.com')
})

test.each(['javascript:alert(1)', 'file:///private/secret', 'https://user:pass@example.com', ''])(
  'does not hand unsafe links to the operating system: %s',
  (href) => {
    expect(tweetLinkUrl(href)).toBeNull()
  },
)
