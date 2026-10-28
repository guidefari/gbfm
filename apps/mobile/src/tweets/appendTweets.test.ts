import { expect, test } from 'vitest'

import { appendTweets } from './appendTweets'

test('appends the next page without repeating tweets shifted across page boundaries', () => {
  const ids = appendTweets([{ id: 'a' }, { id: 'b' }], [{ id: 'b' }, { id: 'c' }]).map(
    ({ id }) => id,
  )

  expect(ids).toEqual(['a', 'b', 'c'])
})
