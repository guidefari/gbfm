import { TWEET_CARD_DIMENSIONS, type TweetCardFormat, type TweetCardModel } from '@gbfm/tweet-card'
import { Resvg, initWasm } from '@resvg/resvg-wasm'
import QRCode from 'qrcode'
import satori, { init as initSatori } from 'satori/standalone'
import { tweetCardTemplate } from './template'

/** Binary and remote asset loader required by the Worker renderer. */
export interface TweetCardRenderAssets {
  readonly loadBinary: (
    name: 'yoga.wasm' | 'resvg.wasm' | 'JetBrainsMono-Bold.ttf' | 'JetBrainsMono-ExtraBold.ttf'
  ) => Promise<ArrayBuffer>
  readonly loadImage: (url: string) => Promise<string | null>
}

let runtimeReady: Promise<void> | undefined

const initializeRuntime = (assets: TweetCardRenderAssets) => {
  if (!runtimeReady) {
    runtimeReady = Promise.all([
      assets.loadBinary('yoga.wasm').then(initSatori),
      assets.loadBinary('resvg.wasm').then(initWasm)
    ])
      .then(() => undefined)
      .catch((error) => {
        runtimeReady = undefined
        throw error
      })
  }
  return runtimeReady
}

const qrDataUrl = async (url: string) => {
  const svg = await QRCode.toString(url, {
    type: 'svg',
    margin: 1,
    color: { dark: '#111827', light: '#ffffff' },
    errorCorrectionLevel: 'H'
  })
  return `data:image/svg+xml;base64,${btoa(svg)}`
}

/** Renders one normalized tweet card to its fixed-size PNG representation. */
export const renderTweetCard = async (
  model: TweetCardModel,
  format: TweetCardFormat,
  assets: TweetCardRenderAssets
): Promise<Uint8Array> => {
  await initializeRuntime(assets)
  const [bold, extraBold, coverImageUrl, avatarUrl, qrUrl] = await Promise.all([
    assets.loadBinary('JetBrainsMono-Bold.ttf'),
    assets.loadBinary('JetBrainsMono-ExtraBold.ttf'),
    model.coverImageUrl ? assets.loadImage(model.coverImageUrl) : null,
    model.avatarUrl ? assets.loadImage(model.avatarUrl) : null,
    qrDataUrl(model.url)
  ])
  const hydratedModel = { ...model, coverImageUrl, avatarUrl }
  const [width, height] = TWEET_CARD_DIMENSIONS[format]
  const svg = await satori(tweetCardTemplate(hydratedModel, format, qrUrl), {
    width,
    height,
    fonts: [
      { name: 'JetBrains Mono', data: bold, weight: 600 },
      { name: 'JetBrains Mono', data: extraBold, weight: 900 }
    ]
  })
  const renderer = new Resvg(svg, {
    fitTo: { mode: 'original' },
    font: { loadSystemFonts: false }
  })
  try {
    return renderer.render().asPng()
  } finally {
    renderer.free()
  }
}
