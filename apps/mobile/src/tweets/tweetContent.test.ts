import { CompiledMicroPostResponse } from '@gbfm/api/post'
import { Match, Predicate, Schema } from 'effect'
import { expect, test } from 'vitest'

import fixture from './inline-content.fixture.json'
import linkedFixture from './linked-inline-content.fixture.json'
import { containsMusic, keyedContent, splitInlineImages, tweetLinkUrl } from './tweetContent'

const document = Schema.decodeUnknownSync(CompiledMicroPostResponse.fields.richContent)(fixture)

if (!document) throw new Error('Missing rich tweet fixture')

const linkedDocument = Schema.decodeUnknownSync(CompiledMicroPostResponse.fields.richContent)(
  linkedFixture,
)

if (!linkedDocument) throw new Error('Missing linked tweet fixture')

test.each([
  { name: 'image-only link', index: 0 },
  { name: 'strong wrapping an image-only link', index: 1 },
  { name: 'link with text before and after its image', index: 2 },
  { name: 'nearest link through formatting and an outer link', index: 3 },
  { name: 'link wrapping nested formatting', index: 4 },
])('preserves the destination for $name', ({ index }) => {
  const paragraph = linkedDocument.blocks[index]

  if (!Predicate.isTagged(paragraph, 'Paragraph')) throw new Error('Missing linked paragraph')

  const sections = splitInlineImages(paragraph.children)
  const href = index === 4 ? '/albums/fixture' : 'https://example.com/album'

  expect(sections.filter((section) => section.type === 'image')).toMatchObject([
    {
      image: { src: 'https://cdn.goosebumps.fm/cover.webp' },
      link: { href, title: index === 4 ? null : 'Album destination' },
    },
  ])
  expect(tweetLinkUrl(href)).toBe(index === 4 ? 'https://goosebumps.fm/albums/fixture' : href)

  expect(sections.map((section) => section.type)).toEqual(
    index === 2 ? ['text', 'image', 'text'] : ['image'],
  )
})

test('keeps linked text before and after its linked image', () => {
  const paragraph = linkedDocument.blocks[2]

  if (!Predicate.isTagged(paragraph, 'Paragraph')) throw new Error('Missing linked paragraph')

  const sections = splitInlineImages(paragraph.children)

  expect(sections[0]).toMatchObject({
    inlines: [{ href: 'https://example.com/album', children: [{ value: 'Before the artwork' }] }],
  })
  expect(sections[2]).toMatchObject({
    inlines: [{ href: 'https://example.com/album', children: [{ value: 'After the artwork' }] }],
  })
})

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
  expect(sections[1]).toMatchObject({ link: null })
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
