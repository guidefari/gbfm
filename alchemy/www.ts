import * as Cloudflare from 'alchemy/Cloudflare'
import * as Effect from 'effect/Effect'

import type { WebsiteConfig } from './config'
import { workerObservability } from './observability'
import type { SocialImageWorker } from './social-image'
import type { StageConfig } from './stage'

export interface WebsiteInput {
  readonly config: StageConfig
  readonly websiteConfig: WebsiteConfig
  readonly api: Cloudflare.Worker
  readonly socialImages: SocialImageWorker
}

export const website = ({ config, websiteConfig, api, socialImages }: WebsiteInput) =>
  Effect.gen(function* () {
    const browserTelemetry = yield* Cloudflare.AnalyticsEngine.Dataset('BrowserTelemetry', {
      dataset: `gbfm-www-${config.stage}`,
    })

    return yield* Cloudflare.Website.SvelteKit('Www', {
      rootDir: 'apps/www',
      ...(config.isProduction
        ? { domain: { name: 'www.goosebumps.fm', aliases: ['goosebumps.fm'] } }
        : { url: true }),
      assets: {
        notFoundHandling: '404-page',
      },
      observability: workerObservability(config.isProduction),
      ...(config.isLocalDev
        ? { dev: { mode: 'external', url: 'https://gbfm.localhost' } }
        : undefined),
      env: {
        API: api,
        SOCIAL_IMAGES: socialImages,
        BROWSER_TELEMETRY: browserTelemetry,
        APP_STAGE: config.stage,
        VITE_SPOTIFY_CLIENT_ID: websiteConfig.spotifyClientId,
      },
    })
  })
