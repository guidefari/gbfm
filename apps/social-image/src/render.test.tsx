import { readFile } from 'node:fs/promises'
import { describe, expect, test } from 'vitest'
import { renderTweetCard, type TweetCardRenderAssets } from './render'

const model = {
  commentary: 'A retryable renderer initialization',
  authorName: 'Guide',
  username: 'guide',
  avatarUrl: null,
  dateLabel: 'Sep 13, 2026',
  entityLabel: null,
  entityTitle: null,
  entityArtists: null,
  coverImageUrl: null,
  url: 'https://goosebumps.fm/tweet/retryable-renderer'
}

const assetPath = (
  name:
    | Parameters<TweetCardRenderAssets['loadWasm']>[0]
    | Parameters<TweetCardRenderAssets['loadFont']>[0]
) => new URL(`../assets/${name}`, import.meta.url).pathname

describe('tweet card renderer runtime', () => {
  test('retries initialization after a transient asset failure', async () => {
    let failInitialization = true
    const assets: TweetCardRenderAssets = {
      loadWasm: async (name) => {
        if (failInitialization) throw new Error('transient static asset failure')
        const bytes = await readFile(assetPath(name))
        return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
      },
      loadFont: async (name) => {
        const bytes = await readFile(assetPath(name))
        return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
      },
      loadImage: async () => null
    }

    await expect(renderTweetCard(model, 'openGraph', assets)).rejects.toThrow(
      'transient static asset failure'
    )
    failInitialization = false

    const png = await renderTweetCard(model, 'openGraph', assets)
    expect(png.subarray(0, 8)).toEqual(
      new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    )
  })
})
