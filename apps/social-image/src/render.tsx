import {
  SOCIAL_CARD_DIMENSIONS,
  type SocialCardFormat,
  type SocialCardModel
} from '@gbfm/social-card'
import { Resvg, initWasm } from '@resvg/resvg-wasm'
import QRCode from 'qrcode'
import satori, { init as initSatori } from 'satori/standalone'
import { socialCardTemplate } from './template'

/** Binary and remote asset loader required by the Worker renderer. */
export interface SocialCardRenderAssets {
  readonly loadWasm: (name: 'yoga.wasm' | 'resvg.wasm') => Promise<WebAssembly.Module | ArrayBuffer>
  readonly loadFont: (
    name: 'JetBrainsMono-Bold.ttf' | 'JetBrainsMono-ExtraBold.ttf'
  ) => Promise<ArrayBuffer>
  readonly loadImage: (url: string) => Promise<string | null>
}

let runtimeReady: Promise<void> | undefined

const initializeRuntime = (assets: SocialCardRenderAssets) => {
  if (!runtimeReady) {
    runtimeReady = Promise.all([
      assets.loadWasm('yoga.wasm').then(initSatori),
      assets.loadWasm('resvg.wasm').then(initWasm)
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

const hydrateImages = async (model: SocialCardModel, assets: SocialCardRenderAssets) => {
  switch (model._tag) {
    case 'ArtworkCard':
      return {
        ...model,
        artworkUrl: model.artworkUrl ? await assets.loadImage(model.artworkUrl) : null
      }
    case 'IdentityCard':
      return {
        ...model,
        imageUrl: model.imageUrl ? await assets.loadImage(model.imageUrl) : null
      }
    case 'EditorialCard':
      return {
        ...model,
        imageUrl: model.imageUrl ? await assets.loadImage(model.imageUrl) : null
      }
    case 'TweetCard': {
      const [coverImageUrl, avatarUrl] = await Promise.all([
        model.coverImageUrl ? assets.loadImage(model.coverImageUrl) : null,
        model.avatarUrl ? assets.loadImage(model.avatarUrl) : null
      ])
      return { ...model, coverImageUrl, avatarUrl }
    }
    default:
      return model satisfies never
  }
}

/** Renders one normalized social card to its fixed-size PNG representation. */
export const renderSocialCard = async (
  model: SocialCardModel,
  format: SocialCardFormat,
  assets: SocialCardRenderAssets
): Promise<Uint8Array> => {
  if (model._tag !== 'TweetCard' && format !== 'openGraph') {
    throw new Error(`${model._tag} does not support ${format}`)
  }
  await initializeRuntime(assets)
  const [bold, extraBold, hydratedModel, qrUrl] = await Promise.all([
    assets.loadFont('JetBrainsMono-Bold.ttf'),
    assets.loadFont('JetBrainsMono-ExtraBold.ttf'),
    hydrateImages(model, assets),
    model._tag === 'TweetCard' && format !== 'openGraph' ? qrDataUrl(model.url) : ''
  ])
  const [width, height] = SOCIAL_CARD_DIMENSIONS[format]
  const svg = await satori(socialCardTemplate(hydratedModel, format, qrUrl), {
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
