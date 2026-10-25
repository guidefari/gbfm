import { inertHtml as h } from 'foldkit/html'
import { describe, expect, it } from 'vitest'

import { artworkUrl, imageSource, preloadArtwork } from './artwork'

describe('private artwork delivery', () => {
  it('keeps the canonical path inert until the preview Mount authorizes it', async () => {
    const url = 'https://cdn.goosebumps.fm/user-content/private/owner/id/art.webp'
    expect(imageSource(url)).toEqual(h.DataAttribute('private-media-src', url))
    expect(artworkUrl(url, 640)).toBe(url)
    // No Image global exists here: private preload must not start an unauthorized request.
    await expect(preloadArtwork(url, '100vw')).resolves.toBeUndefined()
  })

  it('leaves public sources and responsive transformations unchanged', () => {
    const url = 'https://cdn.goosebumps.fm/user-content/public/art.webp'
    expect(imageSource(url)).toEqual(h.Src(url))
    expect(artworkUrl(url, 640)).toBe(`${url}?w=640&q=80&f=webp`)
    expect(artworkUrl('https://other.example/cover.jpg', 640)).toBe(
      'https://other.example/cover.jpg',
    )
  })
})
