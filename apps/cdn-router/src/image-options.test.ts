import { describe, expect, test } from 'vitest'
import { parseImageOptions } from './image-options'

describe('parseImageOptions', () => {
  test('accepts bounded responsive image options', () => {
    const result = parseImageOptions(new URL('https://cdn.example/image.jpg?w=640&q=75&f=avif'))

    expect(result).toEqual({ width: 640, quality: 75, format: 'avif' })
  })

  test.each([
    'https://cdn.example/image.jpg',
    'https://cdn.example/image.jpg?w=0',
    'https://cdn.example/image.jpg?w=2049',
    'https://cdn.example/image.jpg?w=640&q=101',
    'https://cdn.example/image.jpg?w=640&f=gif'
  ])('rejects invalid options in %s', (url) => {
    expect(parseImageOptions(new URL(url))).toBeNull()
  })
})
