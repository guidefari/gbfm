import { Match } from 'effect'

import type { Tweet } from '@/api/tweets'

export type TweetBlock = NonNullable<Tweet['richContent']>['blocks'][number]

export type TweetInline = Extract<TweetBlock, { readonly _tag: 'Paragraph' }>['children'][number]

type ImageInline = Extract<TweetInline, { readonly _tag: 'Image' }>

type StyledInline = Extract<TweetInline, { readonly children: ReadonlyArray<TweetInline> }>

type InlineSection =
  | { readonly type: 'text'; readonly inlines: ReadonlyArray<TweetInline> }
  | { readonly type: 'image'; readonly image: ImageInline }

const styledSections = (inline: StyledInline): ReadonlyArray<InlineSection> =>
  splitInlineImages(inline.children).map((section) =>
    section.type === 'image'
      ? section
      : { type: 'text', inlines: [{ ...inline, children: section.inlines }] },
  )

const sectionsFor = (inline: TweetInline): ReadonlyArray<InlineSection> =>
  Match.valueTags(inline, {
    Image: (image): ReadonlyArray<InlineSection> => [{ type: 'image', image }],
    Emphasis: styledSections,
    Strong: styledSections,
    Delete: styledSections,
    Link: styledSections,
    Text: (node): ReadonlyArray<InlineSection> => [{ type: 'text', inlines: [node] }],
    InlineCode: (node): ReadonlyArray<InlineSection> => [{ type: 'text', inlines: [node] }],
    Break: (node): ReadonlyArray<InlineSection> => [{ type: 'text', inlines: [node] }],
  })

export const splitInlineImages = (
  inlines: ReadonlyArray<TweetInline>,
): ReadonlyArray<InlineSection> => {
  const sections: Array<InlineSection> = []
  let text: Array<TweetInline> = []

  for (const inline of inlines) {
    for (const section of sectionsFor(inline)) {
      if (section.type === 'text') {
        text.push(...section.inlines)
      } else {
        if (text.length > 0) sections.push({ type: 'text', inlines: text })
        text = []
        sections.push(section)
      }
    }
  }

  if (text.length > 0) sections.push({ type: 'text', inlines: text })

  return sections
}

export const keyedContent = <T>(items: ReadonlyArray<T>) => {
  const seen = new Map<string, number>()

  return items.map((item) => {
    const signature = JSON.stringify(item)
    const occurrence = seen.get(signature) ?? 0
    seen.set(signature, occurrence + 1)

    return { key: `${occurrence}:${signature}`, item }
  })
}

export const containsMusic = (blocks: ReadonlyArray<TweetBlock>, entityId: string): boolean =>
  blocks.some((block) =>
    Match.value(block).pipe(
      Match.tag('MusicEmbed', ({ music }) => music.entityId === entityId),
      Match.tag('Quote', 'CardGroup', ({ children }) => containsMusic(children, entityId)),
      Match.tag('List', ({ items }) =>
        items.some((item) => containsMusic(item.children, entityId)),
      ),
      Match.orElse(() => false),
    ),
  )

export const tweetLinkUrl = (href: string): string | null => {
  if (!href.trim()) return null

  try {
    const url = new URL(href, 'https://goosebumps.fm')

    return ['https:', 'http:', 'mailto:'].includes(url.protocol) && !url.username && !url.password
      ? url.href
      : null
  } catch {
    return null
  }
}
