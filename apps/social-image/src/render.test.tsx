import { TweetCardModel } from '@gbfm/social-card'
import { env } from 'cloudflare:workers'
import { describe, expect, test } from 'vitest'

import resvgWasm from '../assets/resvg.wasm'
import yogaWasm from '../assets/yoga.wasm'
import { renderSocialCard, type SocialCardRenderAssets } from './render'

const model = TweetCardModel.make({
  _tag: TweetCardModel.fields._tag.make('TweetCard'),
  kind: 'tweet',
  commentary: 'A retryable renderer initialization',
  authorName: 'Guide',
  username: 'guide',
  avatarUrl: null,
  dateLabel: 'Sep 13, 2026',
  entityLabel: null,
  entityTitle: null,
  entityArtists: null,
  coverImageUrl: null,
  url: 'https://goosebumps.fm/tweet/retryable-renderer',
})

describe('tweet card renderer runtime', () => {
  test('retries initialization after a transient asset failure', async () => {
    let failInitialization = true

    const assets: SocialCardRenderAssets = {
      loadWasm: async (name) => {
        if (failInitialization) throw new Error('transient static asset failure')

        return name === 'yoga.wasm' ? yogaWasm : resvgWasm
      },
      loadFont: async (name) => {
        const response = await env.ASSETS.fetch(new Request(`https://assets.internal/${name}`))

        if (!response.ok) throw new Error(`Render asset ${name} returned ${response.status}`)

        return response.arrayBuffer()
      },
      loadImage: async () => null,
    }

    await expect(renderSocialCard(model, 'openGraph', assets)).rejects.toThrow(
      'transient static asset failure',
    )
    failInitialization = false

    const png = await renderSocialCard(model, 'openGraph', assets)
    expect(png.subarray(0, 8)).toEqual(
      new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    )
  })
})
