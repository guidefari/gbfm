import { expect, test } from 'vitest'
import { stripEmptyValues } from './strip-empty-values'

test('removes empty form values while preserving meaningful scalar and array values', async () => {
  const result = await stripEmptyValues({
    title: 'Test Label',
    description: '',
    website: '   ',
    bandcamp: null,
    emptyTags: [],
    genres: ['house', '', '   ', null, 'techno'],
    blankGenres: ['', '   ', null],
    draft: false,
    score: 0
  })

  expect(result).toEqual({
    title: 'Test Label',
    genres: ['house', 'techno'],
    draft: false,
    score: 0
  })
})
