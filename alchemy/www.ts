import * as Cloudflare from 'alchemy/Cloudflare'
import * as Effect from 'effect/Effect'
import * as Output from 'alchemy/Output'
import type { WebsiteConfig } from './config'
import { workerObservability } from './observability'
import type { StageConfig } from './stage'
import type { SocialImageWorker } from './social-image'

export interface WebsiteInput {
  readonly config: StageConfig
  readonly websiteConfig: WebsiteConfig
  readonly api: Cloudflare.Worker
  readonly socialImages: SocialImageWorker
  readonly apiUrl: Output.Output<string | undefined>
}

const requireApiUrl = (url: string | undefined) => {
  if (url === undefined) throw new Error('Api Worker URL is missing')
  return url
}

export const website = ({ config, websiteConfig, api, socialImages, apiUrl }: WebsiteInput) =>
  Effect.gen(function* () {
    return yield* Cloudflare.Website.Astro('Www', {
      rootDir: 'apps/www',
      astro: { output: 'server' },
      sessionKVBindingName: false,
      ...(config.isProduction
        ? { domain: { name: 'www.goosebumps.fm', aliases: ['goosebumps.fm'] } }
        : { url: true }),
      assets: {
        notFoundHandling: '404-page',
        runWorkerFirst: true
      },
      observability: workerObservability(config.isProduction),
      ...(config.isLocalDev ? { dev: {} } : undefined),
      env: {
        API: api,
        SOCIAL_IMAGES: socialImages,
        ...(config.isLocalDev
          ? { VPS_PROXY_TARGET: Output.map(apiUrl, requireApiUrl) }
          : undefined),
        VITE_VPS_BASE_URL: config.isLocalDev ? '' : config.apiUrl,
        VITE_PUBLIC_SENTRY_DSN: websiteConfig.sentryDsn,
        VITE_PUBLIC_SENTRY_ENVIRONMENT: config.stage,
        VITE_PUBLIC_SENTRY_RELEASE: websiteConfig.sentryRelease,
        VITE_SPOTIFY_CLIENT_ID: websiteConfig.spotifyClientId
      }
    })
  })
