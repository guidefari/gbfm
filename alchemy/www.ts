import * as Cloudflare from 'alchemy/Cloudflare'
import * as Effect from 'effect/Effect'
import type { WebsiteConfig } from './config'
import { workerObservability } from './observability'
import type { StageConfig } from './stage'

export const website = (config: StageConfig, websiteConfig: WebsiteConfig) =>
  Effect.gen(function* () {
    return yield* Cloudflare.Website.StaticSite('Www', {
      cwd: 'apps/www',
      command: 'bun run build',
      outdir: 'dist',
      ...(config.isProduction
        ? { domain: { name: 'www.goosebumps.fm', aliases: ['goosebumps.fm'] } }
        : { url: true }),
      assets: { notFoundHandling: 'single-page-application' },
      observability: workerObservability(config.isProduction),
      dev: config.isLocalDev
        ? {
            command: 'bun run dev',
            cwd: 'apps/www',
            env: {
              VPS_PROXY_TARGET: 'http://127.0.0.1:1338',
              VITE_SPOTIFY_CLIENT_ID: websiteConfig.spotifyClientId
            }
          }
        : undefined,
      env: {
        VITE_VPS_BASE_URL: config.isLocalDev ? '' : config.apiUrl,
        VITE_PUBLIC_SENTRY_DSN: websiteConfig.sentryDsn,
        VITE_PUBLIC_SENTRY_ENVIRONMENT: config.stage,
        VITE_PUBLIC_SENTRY_RELEASE: websiteConfig.sentryRelease,
        VITE_SPOTIFY_CLIENT_ID: websiteConfig.spotifyClientId
      }
    })
  })
