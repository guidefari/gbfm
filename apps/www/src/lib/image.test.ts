import { describe, expect, test } from 'vitest'
import { toImageSrcSet, toImageUrl } from './image'

describe('responsive image URLs', () => {
  test('adds bounded transformation options to GBFM CDN images', () => {
    expect(
      toImageUrl('https://cdn.goosebumps.fm/user-content/artwork.png', {
        width: 640,
        quality: 75,
        format: 'avif'
      })
    ).toBe('https://cdn.goosebumps.fm/user-content/artwork.png?w=640&q=75&f=avif')
  })

  test('leaves external and invalid image URLs untouched', () => {
    expect(toImageUrl('https://i.scdn.co/cover.jpg', { width: 320 })).toBe(
      'https://i.scdn.co/cover.jpg'
    )
    expect(toImageUrl('/fav.png', { width: 320 })).toBe('/fav.png')
  })

  test('builds a responsive source set only for CDN images', () => {
    expect(toImageSrcSet('https://cdn.goosebumps.fm/user-content/art.jpg', [320, 640])).toBe(
      'https://cdn.goosebumps.fm/user-content/art.jpg?w=320&q=80&f=webp 320w, https://cdn.goosebumps.fm/user-content/art.jpg?w=640&q=80&f=webp 640w'
    )
    expect(toImageSrcSet('https://example.com/art.jpg', [320, 640])).toBeUndefined()
  })
})
