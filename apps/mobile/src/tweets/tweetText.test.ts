import { CompiledMicroPostResponse } from '@gbfm/api/post'
import { Schema } from 'effect'
import { expect, test } from 'vitest'

import richContentFixture from './rich-content.fixture.json'
import {
  formatTweetDate,
  keyedParagraphs,
  replyCountLabel,
  tweetParagraphs,
  tweetSnippet,
} from './tweetText'

type TweetTextSource = Parameters<typeof tweetParagraphs>[0]

test('uses the title as the opening paragraph when a tweet has no body', () => {
  const tweet: TweetTextSource = {
    title: 'what a chugger.',
    content: null,
    richContent: { version: 1, blocks: [] },
  }

  expect(tweetParagraphs(tweet)).toEqual(['what a chugger.'])
})

test('flattens rich content blocks into readable paragraphs', () => {
  const tweet: TweetTextSource = {
    title: null,
    content: null,
    richContent: Schema.decodeUnknownSync(CompiledMicroPostResponse.fields.richContent)(
      richContentFixture,
    ),
  }

  expect(tweetParagraphs(tweet)).toEqual(['listen to this', '• first'])
})

test('falls back to splitting plain content when rich content is missing', () => {
  const tweet: TweetTextSource = { title: null, content: 'one\n\ntwo' }

  expect(tweetParagraphs(tweet)).toEqual(['one', 'two'])
})

test('truncates long snippets with an ellipsis', () => {
  const tweet: TweetTextSource = { title: 'abcdefghij', content: null }

  expect(tweetSnippet(tweet, 4)).toBe('abcd…')
})

test('omits the year for dates in the current year', () => {
  const now = new Date('2026-10-29T12:00:00Z')

  expect(formatTweetDate('2026-10-05T15:34:26.784Z', now)).toBe('5 Oct')
  expect(formatTweetDate('2025-10-05T15:34:26.784Z', now)).toBe('5 Oct 2025')
})

test('pluralises reply counts', () => {
  expect(replyCountLabel(1)).toBe('1 reply')
  expect(replyCountLabel(3)).toBe('3 replies')
})

test('keys repeated paragraphs by occurrence so siblings stay unique', () => {
  expect(keyedParagraphs(['a', 'b', 'a']).map(({ key }) => key)).toEqual(['0:a', '0:b', '1:a'])
})
