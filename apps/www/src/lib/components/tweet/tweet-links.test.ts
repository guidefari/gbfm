import { expect, test } from 'vitest'

import { tweetLinks } from './tweet-links'

const directions = { newer: 'newer-tweet', older: 'older-tweet', olderUnread: 'unread-tweet' }

test('older skips to the next unread tweet by default', () => {
  expect(tweetLinks(directions, 'unread')).toEqual({
    newer: '/tweet/newer-tweet',
    older: '/tweet/unread-tweet',
  })
})

test('older walks every tweet when the reader wants everything', () => {
  expect(tweetLinks(directions, 'all').older).toBe('/tweet/older-tweet')
})

test('older falls back to the next tweet when nothing older is unread', () => {
  expect(tweetLinks({ ...directions, olderUnread: null }, 'unread').older).toBe(
    '/tweet/older-tweet',
  )
  expect(tweetLinks(null, 'unread')).toEqual({ newer: null, older: null })
})
