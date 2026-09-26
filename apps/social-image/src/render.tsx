import {
  SOCIAL_CARD_DIMENSIONS,
  type SocialCardFormat,
  type SocialCardModel,
} from '@gbfm/social-card'
import { Resvg, initWasm } from '@resvg/resvg-wasm'
import { Match } from 'effect'
import QRCode from 'qrcode'
import satori, { init as initSatori } from 'satori/standalone'

import { socialCardTemplate } from './template'

/** Binary and remote asset loader required by the Worker renderer. */
export interface SocialCardRenderAssets {
  readonly loadWasm: (name: 'yoga.wasm' | 'resvg.wasm') => Promise<WebAssembly.Module | ArrayBuffer>
  readonly loadFont: (
    name: 'JetBrainsMono-Bold.ttf' | 'JetBrainsMono-ExtraBold.ttf',
  ) => Promise<ArrayBuffer>
  readonly loadImage: (url: string) => Promise<string | null>
}

let runtimeReady: Promise<void> | undefined

const initializeRuntime = (assets: SocialCardRenderAssets) => {
  if (!runtimeReady) {
    runtimeReady = Promise.all([
      assets.loadWasm('yoga.wasm').then(initSatori),
      assets.loadWasm('resvg.wasm').then(initWasm),
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
    errorCorrectionLevel: 'H',
  })

  return `data:image/svg+xml;base64,${btoa(svg)}`
}

const hydrateImages = async (model: SocialCardModel, assets: SocialCardRenderAssets) => {
  return Match.value(model).pipe(
    Match.tag('ArtworkCard', async (card) => ({
      ...card,
      artworkUrl: card.artworkUrl ? await assets.loadImage(card.artworkUrl) : null,
    })),
    Match.tag('IdentityCard', async (card) => ({
      ...card,
      imageUrl: card.imageUrl ? await assets.loadImage(card.imageUrl) : null,
    })),
    Match.tag('EditorialCard', async (card) => ({
      ...card,
      imageUrl: card.imageUrl ? await assets.loadImage(card.imageUrl) : null,
    })),
    Match.tag('TweetCard', async (card) => {
      const [coverImageUrl, avatarUrl] = await Promise.all([
        card.coverImageUrl ? assets.loadImage(card.coverImageUrl) : null,
        card.avatarUrl ? assets.loadImage(card.avatarUrl) : null,
      ])

      return { ...card, coverImageUrl, avatarUrl }
    }),
    Match.exhaustive,
  )
}

/** Renders one normalized social card to its fixed-size PNG representation. */
export const renderSocialCard = async (
  model: SocialCardModel,
  format: SocialCardFormat,
  assets: SocialCardRenderAssets,
): Promise<Uint8Array> => {
  if (
    !Match.value(model).pipe(
      Match.tag('TweetCard', () => true),
      Match.orElse(() => false),
    ) &&
    format !== 'openGraph'
  ) {
    throw new Error(`${model._tag} does not support ${format}`)
  }

  await initializeRuntime(assets)

  const [bold, extraBold, hydratedModel, qrUrl] = await Promise.all([
    assets.loadFont('JetBrainsMono-Bold.ttf'),
    assets.loadFont('JetBrainsMono-ExtraBold.ttf'),
    hydrateImages(model, assets),
    Match.value(model).pipe(
      Match.tag('TweetCard', (card) => (format !== 'openGraph' ? qrDataUrl(card.url) : '')),
      Match.orElse(() => ''),
    ),
  ])

  const [width, height] = SOCIAL_CARD_DIMENSIONS[format]

  const svg = await satori(socialCardTemplate(hydratedModel, format, qrUrl), {
    width,
    height,
    fonts: [
      { name: 'JetBrains Mono', data: bold, weight: 600 },
      { name: 'JetBrains Mono', data: extraBold, weight: 900 },
    ],
  })

  const renderer = new Resvg(svg, {
    fitTo: { mode: 'original' },
    font: { loadSystemFonts: false },
  })

  try {
    return renderer.render().asPng()
  } finally {
    renderer.free()
  }
}
