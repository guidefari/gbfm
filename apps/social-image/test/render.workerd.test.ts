import { env } from 'cloudflare:workers'
import { describe, expect, test } from 'vitest'
import type { TweetCardModel } from '@gbfm/tweet-card'
import resvgWasm from '../assets/resvg.wasm'
import yogaWasm from '../assets/yoga.wasm'
import { renderTweetCard, type TweetCardRenderAssets } from '../src/render'

const model: TweetCardModel = {
  commentary: 'A workerd renderer check',
  authorName: 'Guide',
  username: 'guide',
  avatarUrl: null,
  dateLabel: 'Sep 17, 2026',
  entityLabel: null,
  entityTitle: null,
  entityArtists: null,
  coverImageUrl: null,
  url: 'https://goosebumps.fm/tweet/workerd-renderer'
}

const assets: TweetCardRenderAssets = {
  loadWasm: async (name) => (name === 'yoga.wasm' ? yogaWasm : resvgWasm),
  loadFont: async (name) => {
    const response = await env.ASSETS.fetch(new Request(`https://assets.internal/${name}`))
    if (!response.ok) throw new Error(`Render asset ${name} returned ${response.status}`)
    return response.arrayBuffer()
  },
  loadImage: async () => null
}

describe('tweet card renderer in workerd', () => {
  test('renders a PNG with deployed static assets', async () => {
    expect(yogaWasm).toBeInstanceOf(WebAssembly.Module)
    expect(resvgWasm).toBeInstanceOf(WebAssembly.Module)
    const png = await renderTweetCard(model, 'openGraph', assets)

    expect(png.subarray(0, 8)).toEqual(
      new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    )
  })
})
