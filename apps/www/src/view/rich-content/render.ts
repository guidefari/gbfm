import type { RichContentBlock, RichContentDocument } from '@gbfm/rich-content/schema'
import type { Html, HtmlBuilder } from 'foldkit/html'

type RichContentInline = Extract<
  RichContentBlock,
  { readonly _tag: 'Paragraph' }
>['children'][number]

/** Presentation options for a rendered rich-content document. */
export interface RichContentViewOptions {
  readonly className?: string
}

const unreachable = (value: never): never => {
  throw new Error(`Unhandled rich-content variant: ${String(value)}`)
}

const isOutbound = (href: string): boolean =>
  href.startsWith('https://') || href.startsWith('http://') || href.startsWith('mailto:')

const linkAttributes = <Message>(href: string, h: HtmlBuilder<Message>) => [
  h.Href(href),
  ...(isOutbound(href) ? [h.Target('_blank'), h.Rel('noopener noreferrer')] : []),
]

const inlineView = <Message>(inline: RichContentInline, h: HtmlBuilder<Message>): Html | string => {
  // oxlint-disable-next-line anti-slop-effect/no-manual-tag-comparison -- Schema-owned recursive unions have no generated matcher; this switch provides compile-time exhaustiveness.
  switch (inline._tag) {
    case 'Text':
      return inline.value
    case 'Emphasis':
      return h.em(
        [],
        inline.children.map((child) => inlineView(child, h)),
      )
    case 'Strong':
      return h.strong(
        [],
        inline.children.map((child) => inlineView(child, h)),
      )
    case 'Delete':
      return h.del(
        [],
        inline.children.map((child) => inlineView(child, h)),
      )
    case 'InlineCode':
      return h.code([], [inline.value])
    case 'Link':
      return h.a(
        [...linkAttributes(inline.href, h), ...(inline.title ? [h.Title(inline.title)] : [])],
        inline.children.map((child) => inlineView(child, h)),
      )
    case 'Image':
      return h.img([
        h.Src(inline.src),
        h.Alt(inline.alt),
        h.Loading('lazy'),
        h.Decoding('async'),
        ...(inline.title ? [h.Title(inline.title)] : []),
      ])
    case 'Break':
      return h.br([])
    default:
      return unreachable(inline)
  }
}

const inlineChildren = <Message>(
  children: ReadonlyArray<RichContentInline>,
  h: HtmlBuilder<Message>,
): ReadonlyArray<Html | string> => children.map((child) => inlineView(child, h))

const headingView = <Message>(
  block: Extract<RichContentBlock, { readonly _tag: 'Heading' }>,
  h: HtmlBuilder<Message>,
): Html => {
  const children = inlineChildren(block.children, h)

  switch (block.level) {
    case 1:
      return h.h1([], children)
    case 2:
      return h.h2([], children)
    case 3:
      return h.h3([], children)
    case 4:
      return h.h4([], children)
    case 5:
      return h.h5([], children)
    case 6:
      return h.h6([], children)
    default:
      return unreachable(block.level)
  }
}

const listView = <Message>(
  block: Extract<RichContentBlock, { readonly _tag: 'List' }>,
  h: HtmlBuilder<Message>,
): Html => {
  const items = block.items.map((item) =>
    h.li(item.checked === null ? [] : [h.Class('rich-content-task-item')], [
      ...(item.checked === null
        ? []
        : [
            h.input([
              h.Type('checkbox'),
              h.Checked(item.checked),
              h.Disabled(true),
              h.AriaLabel(item.checked ? 'Completed task' : 'Incomplete task'),
            ]),
          ]),
      ...item.children.map((child) => blockView(child, h)),
    ]),
  )

  return block.ordered
    ? h.ol(block.start === null ? [] : [h.Start(block.start)], items)
    : h.ul([], items)
}

const tableCellAlignment = <Message>(
  alignment: 'left' | 'center' | 'right' | null | undefined,
  h: HtmlBuilder<Message>,
) => (alignment === null || alignment === undefined ? [] : [h.Style({ textAlign: alignment })])

const tableView = <Message>(
  block: Extract<RichContentBlock, { readonly _tag: 'Table' }>,
  h: HtmlBuilder<Message>,
): Html => {
  const [head, ...body] = block.rows

  const row = (cells: typeof head, header: boolean) =>
    h.tr(
      [],
      (cells ?? []).map((cell, index) =>
        header
          ? h.th(
              [...tableCellAlignment(block.align[index], h), h.Scope('col')],
              inlineChildren(cell, h),
            )
          : h.td(tableCellAlignment(block.align[index], h), inlineChildren(cell, h)),
      ),
    )

  return h.table(
    [],
    [
      ...(head === undefined ? [] : [h.thead([], [row(head, true)])]),
      ...(body.length === 0
        ? []
        : [
            h.tbody(
              [],
              body.map((cells) => row(cells, false)),
            ),
          ]),
    ],
  )
}

const musicView = <Message>(
  block: Extract<RichContentBlock, { readonly _tag: 'MusicEmbed' }>,
  h: HtmlBuilder<Message>,
): Html => {
  const music = block.music

  return h.article(
    [h.Class('rich-content-music-card')],
    [
      ...(music.imageUrl === null
        ? []
        : [
            h.img([
              h.Src(music.imageUrl),
              h.Alt(`Artwork for ${music.title}`),
              h.Loading('lazy'),
              h.Decoding('async'),
            ]),
          ]),
      h.div(
        [],
        [
          h.p([h.Class('rich-content-eyebrow')], [music.entityType]),
          h.h3([], [h.a(linkAttributes(music.canonicalUrl, h), [music.title])]),
          ...(music.artists.length === 0 ? [] : [h.p([], [music.artists.join(', ')])]),
          ...(music.description === null ? [] : [h.p([], [music.description])]),
          ...(block.genres.length === 0
            ? []
            : [
                h.ul(
                  [h.AriaLabel('Genres')],
                  block.genres.map((genre) => h.li([], [genre])),
                ),
              ]),
          ...(block.blurb === null ? [] : [h.p([], [block.blurb])]),
          ...(music.links.length === 0
            ? []
            : [
                h.ul(
                  [h.AriaLabel('Listen on')],
                  music.links.map((link) =>
                    h.li([], [h.a(linkAttributes(link.url, h), [link.platform])]),
                  ),
                ),
              ]),
          ...(block.showTracks && music.tracks.length > 0
            ? [
                h.ol(
                  [h.AriaLabel(`${music.title} tracks`)],
                  music.tracks.map((track) =>
                    h.li(
                      [],
                      [
                        track.url === null
                          ? track.title
                          : h.a(linkAttributes(track.url, h), [track.title]),
                        ...(track.artists.length === 0 ? [] : [` — ${track.artists.join(', ')}`]),
                      ],
                    ),
                  ),
                ),
              ]
            : []),
        ],
      ),
    ],
  )
}

const mediaView = <Message>(
  block: Extract<RichContentBlock, { readonly _tag: 'ExternalMediaEmbed' }>,
  h: HtmlBuilder<Message>,
): Html =>
  h.figure(
    [h.Class('rich-content-media')],
    [
      h.div(
        [h.Style({ aspectRatio: String(block.aspectRatio) })],
        [
          h.iframe(
            [
              h.Src(block.embedUrl),
              h.Title(block.title),
              h.Width('100%'),
              h.Height('100%'),
              h.Loading('lazy'),
              h.Referrerpolicy('strict-origin-when-cross-origin'),
              h.Allow('autoplay; encrypted-media; fullscreen; picture-in-picture'),
              h.Sandbox('allow-scripts allow-same-origin allow-presentation allow-popups'),
            ],
            [],
          ),
        ],
      ),
      h.figcaption(
        [],
        [h.a(linkAttributes(block.canonicalUrl, h), [`Open ${block.title} on ${block.provider}`])],
      ),
    ],
  )

const blockView = <Message>(block: RichContentBlock, h: HtmlBuilder<Message>): Html => {
  // oxlint-disable-next-line anti-slop-effect/no-manual-tag-comparison -- Schema-owned recursive unions have no generated matcher; this switch provides compile-time exhaustiveness.
  switch (block._tag) {
    case 'Paragraph':
      return h.p([], inlineChildren(block.children, h))
    case 'Heading':
      return headingView(block, h)
    case 'List':
      return listView(block, h)
    case 'Quote':
      return h.blockquote(
        [],
        block.children.map((child) => blockView(child, h)),
      )
    case 'Code':
      return h.pre(
        [],
        [
          ...(block.language === null
            ? []
            : [h.span([h.Class('rich-content-code-language')], [block.language])]),
          h.code([], [block.value]),
        ],
      )
    case 'ThematicBreak':
      return h.hr([])
    case 'Table':
      return tableView(block, h)
    case 'MusicEmbed':
      return musicView(block, h)
    case 'ExternalMediaEmbed':
      return mediaView(block, h)
    case 'Tracklist':
      return h.ol(
        [h.Class('rich-content-tracklist'), h.AriaLabel('Tracklist')],
        block.tracks.map((track) => h.li([], [track.title])),
      )
    case 'CardGroup':
      return h.div(
        [h.Class('rich-content-card-group'), h.Role('group'), h.AriaLabel('Related music')],
        block.children.map((child) => blockView(child, h)),
      )
    case 'UnavailableEmbed':
      return h.aside(
        [h.Class('rich-content-unavailable'), h.Role('status')],
        [
          h.p([], [block.label]),
          ...(block.href === null
            ? []
            : [h.a(linkAttributes(block.href, h), ['Open the original content'])]),
        ],
      )
    case 'Unsupported':
      return h.aside(
        [h.Class('rich-content-unsupported')],
        [
          h.p([], [`Unsupported content (${block.reason})`]),
          h.pre([], [h.code([], [block.source])]),
        ],
      )
    default:
      return unreachable(block)
  }
}

/** Maps a decoded rich-content document to inert Foldkit HTML without parsing source. */
export const richContentView = <Message>(
  document: RichContentDocument,
  h: HtmlBuilder<Message>,
  options: RichContentViewOptions = {},
): Html =>
  h.div(
    [h.Class(['rich-content', options.className].filter((value) => value !== undefined).join(' '))],
    document.blocks.map((block) => blockView(block, h)),
  )
