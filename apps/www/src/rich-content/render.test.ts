import type { RichContentDocument, SafeUrl } from '@gbfm/rich-content/schema'
import { inertHtml as h, type Html } from 'foldkit/html'
import { describe, expect, it } from 'vitest'

import { richContentView } from './render'

const safeUrl = (value: string): SafeUrl => {
  // SAFETY: Every URL passed by this closed test fixture uses an allowed HTTPS URL shape.
  // oxlint-disable-next-line anti-slop/require-safety-comment-for-type-assertion, typescript/no-unsafe-type-assertion
  return value
}

// oxlint-disable anti-slop-effect/no-manual-tagged-construction -- This models a decoded document fixture at the renderer's typed boundary.
const document: RichContentDocument = {
  version: 1,
  blocks: [
    {
      _tag: 'Heading',
      level: 1,
      children: [{ _tag: 'Text', value: 'Title' }],
    },
    {
      _tag: 'Paragraph',
      children: [
        { _tag: 'Text', value: 'Text ' },
        { _tag: 'Emphasis', children: [{ _tag: 'Text', value: 'emphasis' }] },
        { _tag: 'Strong', children: [{ _tag: 'Text', value: 'strong' }] },
        { _tag: 'Delete', children: [{ _tag: 'Text', value: 'deleted' }] },
        { _tag: 'InlineCode', value: 'code' },
        {
          _tag: 'Link',
          href: safeUrl('https://example.com/read'),
          title: 'Read more',
          children: [{ _tag: 'Text', value: 'link' }],
        },
        {
          _tag: 'Image',
          src: safeUrl('https://example.com/image.jpg'),
          alt: 'A test image',
          title: 'Image title',
        },
        { _tag: 'Break' },
      ],
    },
    {
      _tag: 'List',
      ordered: true,
      start: 3,
      items: [
        {
          checked: true,
          children: [
            { _tag: 'Paragraph', children: [{ _tag: 'Text', value: 'Task' }] },
            {
              _tag: 'List',
              ordered: false,
              start: null,
              items: [
                {
                  checked: null,
                  children: [{ _tag: 'Paragraph', children: [{ _tag: 'Text', value: 'Nested' }] }],
                },
              ],
            },
          ],
        },
      ],
    },
    {
      _tag: 'Quote',
      children: [{ _tag: 'Paragraph', children: [{ _tag: 'Text', value: 'Quoted' }] }],
    },
    { _tag: 'Code', language: 'ts', value: 'const inert = true' },
    { _tag: 'ThematicBreak' },
    {
      _tag: 'Table',
      align: ['left', 'right'],
      rows: [
        [[{ _tag: 'Text', value: 'Name' }], [{ _tag: 'Text', value: 'Count' }]],
        [[{ _tag: 'Text', value: 'Records' }], [{ _tag: 'Text', value: '2' }]],
      ],
    },
    {
      _tag: 'MusicEmbed',
      genres: ['ambient'],
      blurb: 'A quiet record.',
      showTracks: true,
      music: {
        entityType: 'album',
        entityId: 'album-1',
        title: 'Stillness',
        artists: ['Artist'],
        description: 'An album.',
        imageUrl: safeUrl('https://example.com/cover.jpg'),
        canonicalUrl: safeUrl('https://example.com/album'),
        links: [{ platform: 'Bandcamp', url: safeUrl('https://example.com/listen') }],
        tracks: [
          {
            title: 'First',
            artists: ['Artist'],
            url: safeUrl('https://example.com/track'),
          },
        ],
      },
    },
    {
      _tag: 'ExternalMediaEmbed',
      provider: 'youtube',
      canonicalUrl: safeUrl('https://youtube.com/watch?v=video'),
      embedUrl: safeUrl('https://youtube.com/embed/video'),
      title: 'Test video',
      aspectRatio: 16 / 9,
    },
    { _tag: 'Tracklist', tracks: [{ title: 'Artist — Song' }] },
    {
      _tag: 'CardGroup',
      children: [
        {
          _tag: 'UnavailableEmbed',
          kind: 'music',
          label: 'Music unavailable',
          href: safeUrl('https://example.com/fallback'),
        },
      ],
    },
    {
      _tag: 'UnavailableEmbed',
      kind: 'media',
      label: 'Media unavailable',
      href: null,
    },
    {
      _tag: 'Unsupported',
      source: '<script>not executable</script>',
      reason: 'raw-html',
    },
  ],
}
// oxlint-enable anti-slop-effect/no-manual-tagged-construction

const render = () => richContentView(document, h, { className: 'article-body' })

type VNode = NonNullable<Html>

const childNodes = (node: VNode): ReadonlyArray<VNode> =>
  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- Foldkit's public VNode child contract is the explicit union VNode | string.
  (node.children ?? []).filter((child): child is VNode => typeof child !== 'string')

const descendants = (node: VNode): ReadonlyArray<VNode> => [
  node,
  ...childNodes(node).flatMap(descendants),
]

const hasClass = (node: VNode, className: string): boolean => node.data?.class?.[className] === true

const findAll = (node: VNode, selector: string): ReadonlyArray<VNode> =>
  descendants(node).filter((candidate) =>
    selector.startsWith('.') ? hasClass(candidate, selector.slice(1)) : candidate.sel === selector,
  )

const first = (nodes: ReadonlyArray<VNode>): VNode => {
  const node = nodes[0]

  expect(node).toBeDefined()

  if (node === undefined) throw new Error('Expected a matching rendered node')

  return node
}

// oxlint-disable-next-line anti-slop/no-unknown-returns -- Foldkit exposes heterogeneous DOM property values; assertions compare them at this test boundary.
const attribute = (node: VNode, name: string): unknown =>
  node.data?.props?.[name] ?? node.data?.attrs?.[name]

const textContent = (node: VNode): string =>
  node.text ??
  (node.children ?? [])
    // oxlint-disable-next-line anti-slop/no-runtime-typeof -- Foldkit's public VNode child contract is the explicit union VNode | string.
    .map((child) => (typeof child === 'string' ? child : textContent(child)))
    .join('')

describe('richContentView', () => {
  it('renders every rich-content variant as semantic inert HTML', () => {
    const rendered = render()
    const view = first(rendered === null ? [] : [rendered])

    expect(textContent(view)).toContain('Title')
    expect(findAll(view, 'h1')).toHaveLength(1)
    expect(findAll(view, 'em')).toHaveLength(1)
    expect(findAll(view, 'strong')).toHaveLength(1)
    expect(findAll(view, 'del')).toHaveLength(1)
    expect(findAll(view, 'blockquote')).toHaveLength(1)
    expect(findAll(view, 'hr')).toHaveLength(1)
    expect(findAll(view, 'th')).toHaveLength(2)
    expect(findAll(view, 'td')).toHaveLength(2)
    expect(findAll(view, '.rich-content-music-card')).toHaveLength(1)
    expect(findAll(view, '.rich-content-card-group')).toHaveLength(1)
    expect(findAll(view, '.rich-content-tracklist')).toHaveLength(1)
    expect(textContent(view)).toContain('<script>not executable</script>')
  })

  it('preserves heading, list, image, and table accessibility semantics', () => {
    const rendered = render()
    const view = first(rendered === null ? [] : [rendered])
    const list = first(findAll(view, 'ol').filter((node) => attribute(node, 'start') === 3))

    const image = first(
      findAll(view, 'img').filter((node) => attribute(node, 'alt') === 'A test image'),
    )

    const heading = first(findAll(view, 'h1'))

    expect(textContent(heading)).toBe('Title')
    expect(attribute(list, 'start')).toBe(3)
    expect(attribute(image, 'loading')).toBe('lazy')
    expect(findAll(view, 'th').every((node) => attribute(node, 'scope') === 'col')).toBe(true)
    expect(findAll(view, 'input')).toHaveLength(1)
  })

  it('fixes outbound-link and iframe security attributes', () => {
    const rendered = render()
    const view = first(rendered === null ? [] : [rendered])

    const link = first(
      findAll(view, 'a').filter((node) => attribute(node, 'href') === 'https://example.com/read'),
    )

    const iframe = first(findAll(view, 'iframe'))

    expect(attribute(link, 'rel')).toBe('noopener noreferrer')
    expect(attribute(link, 'target')).toBe('_blank')
    expect(attribute(iframe, 'src')).toBe('https://youtube.com/embed/video')
    expect(attribute(iframe, 'title')).toBe('Test video')
    expect(attribute(iframe, 'loading')).toBe('lazy')
    expect(attribute(iframe, 'referrerpolicy')).toBe('no-referrer')
    expect(attribute(iframe, 'sandbox')).toBe(
      'allow-scripts allow-same-origin allow-presentation allow-popups',
    )
    expect(attribute(iframe, 'allow')).toBe(
      'autoplay; encrypted-media; fullscreen; picture-in-picture',
    )
  })

  it('renders unavailable embeds with and without validated fallbacks', () => {
    const rendered = render()
    const view = first(rendered === null ? [] : [rendered])
    const unavailable = findAll(view, '.rich-content-unavailable')

    expect(unavailable).toHaveLength(2)
    expect(findAll(first(unavailable), 'a')).toHaveLength(1)
    expect(findAll(unavailable[1] ?? first([]), 'a')).toHaveLength(0)
    expect(textContent(first(unavailable))).toContain('Music unavailable')
    expect(textContent(unavailable[1] ?? first([]))).toContain('Media unavailable')
  })
})
