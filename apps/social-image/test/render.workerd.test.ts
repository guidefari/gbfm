import { env } from 'cloudflare:workers'
import { describe, expect, test } from 'vitest'
import type { SocialCardModel, TweetCardModel } from '@gbfm/social-card'
import resvgWasm from '../assets/resvg.wasm'
import yogaWasm from '../assets/yoga.wasm'
import { renderSocialCard, type SocialCardRenderAssets } from '../src/render'

const model: TweetCardModel = {
  _tag: 'TweetCard',
  kind: 'tweet',
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

const assets: SocialCardRenderAssets = {
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
    const png = await renderSocialCard(model, 'openGraph', assets)

    expect(png.subarray(0, 8)).toEqual(
      new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    )
  })

  test.each([
    {
      _tag: 'ArtworkCard',
      kind: 'mix',
      eyebrow: 'MIX',
      title: 'Forest Drive West at goosebumps.fm',
      creators: ['Forest Drive West'],
      artworkUrl: null
    },
    {
      _tag: 'IdentityCard',
      kind: 'show',
      eyebrow: 'RADIO SHOW',
      title: 'Far End Radio',
      description: 'An open-ended monthly radio residency.',
      detail: 'Hosted by Guide Fari',
      imageUrl: null
    },
    {
      _tag: 'EditorialCard',
      kind: 'editorial',
      title: 'Active / Passive',
      description: 'Notes on listening with intent.',
      authors: ['Guide Fari'],
      imageUrl: null,
      publishedLabel: 'Sep 18, 2026'
    }
  ] satisfies ReadonlyArray<SocialCardModel>)(
    'renders the $_tag layout to a 1200 by 630 PNG',
    async (card) => {
      const png = await renderSocialCard(card, 'openGraph', assets)

      expect(png.subarray(0, 8)).toEqual(
        new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
      )
    }
  )
})
