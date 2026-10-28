import { Match } from 'effect'

import type { Tweet } from '@/api/tweets'

type RichBlock = NonNullable<Tweet['richContent']>['blocks'][number]

type RichInline = Extract<RichBlock, { readonly _tag: 'Paragraph' }>['children'][number]

const inlineText = (inline: RichInline): string =>
  Match.valueTags(inline, {
    Text: ({ value }) => value,
    InlineCode: ({ value }) => value,
    Emphasis: ({ children }) => inlinesText(children),
    Strong: ({ children }) => inlinesText(children),
    Delete: ({ children }) => inlinesText(children),
    Link: ({ children }) => inlinesText(children),
    Image: ({ alt }) => alt,
    Break: () => '\n',
  })

const inlinesText = (inlines: ReadonlyArray<RichInline>): string => inlines.map(inlineText).join('')

const blockParagraphs = (block: RichBlock): ReadonlyArray<string> =>
  Match.valueTags(block, {
    Paragraph: ({ children }) => [inlinesText(children)],
    Heading: ({ children }) => [inlinesText(children)],
    List: ({ items, ordered, start }) =>
      items.map((item, index) => {
        const marker = ordered ? `${(start ?? 1) + index}.` : '•'

        return `${marker} ${item.children.flatMap(blockParagraphs).join(' ')}`
      }),
    Quote: ({ children }) => children.flatMap(blockParagraphs),
    CardGroup: ({ children }) => children.flatMap(blockParagraphs),
    Code: ({ value }) => [value],
    Table: ({ rows }) => rows.map((row) => row.map(inlinesText).join(' · ')),
    MusicEmbed: ({ music }) => [
      music.artists.length > 0 ? `${music.title} · ${music.artists.join(', ')}` : music.title,
    ],
    ExternalMediaEmbed: ({ title }) => [title],
    Tracklist: ({ tracks }) => tracks.map((track) => track.title),
    UnavailableEmbed: ({ label }) => [label],
    ThematicBreak: () => [],
    Unsupported: () => [],
  })

type TweetTextSource = Pick<Tweet, 'title' | 'content' | 'richContent'>

/** Tweets keep their headline in `title` and any longer body in rich content. */
export const tweetParagraphs = (tweet: TweetTextSource): ReadonlyArray<string> => {
  const body = tweet.richContent
    ? tweet.richContent.blocks.flatMap(blockParagraphs)
    : (tweet.content ?? '').split(/\n{2,}/)

  return [tweet.title ?? '', ...body].flatMap((paragraph) => {
    const trimmed = paragraph.trim()

    return trimmed ? [trimmed] : []
  })
}

export const keyedParagraphs = (paragraphs: ReadonlyArray<string>) => {
  const seen = new Map<string, number>()

  return paragraphs.map((text) => {
    const occurrence = seen.get(text) ?? 0
    seen.set(text, occurrence + 1)

    return { key: `${occurrence}:${text}`, text }
  })
}

export const tweetSnippet = (tweet: TweetTextSource, max = 200) => {
  const flattened = tweetParagraphs(tweet).join(' ').replace(/\s+/g, ' ').trim()

  return flattened.length > max ? `${flattened.slice(0, max).trimEnd()}…` : flattened
}

export const formatTweetDate = (createdAt: string, now = new Date()) => {
  const date = new Date(createdAt)
  const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }

  if (date.getFullYear() !== now.getFullYear()) options.year = 'numeric'

  return date.toLocaleDateString('en-GB', options)
}

export const replyCountLabel = (count: number) => `${count} ${count === 1 ? 'reply' : 'replies'}`
