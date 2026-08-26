import * as Cloudflare from 'alchemy/Cloudflare'
import * as Effect from 'effect/Effect'
import { workerObservability } from './observability'
import type { StageConfig } from './stage'

export const website = (config: StageConfig) =>
  Effect.gen(function* () {
    const spotifyClientId = process.env.SPOTIFY_CLIENT_ID ?? ''

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
            command: 'bun run dev -- --port 5173 --strictPort',
            cwd: 'apps/www',
            url: 'http://127.0.0.1:5173',
            env: {
              VPS_PROXY_TARGET: 'http://127.0.0.1:1338',
              VITE_SPOTIFY_CLIENT_ID: spotifyClientId
            }
          }
        : undefined,
      env: {
        VITE_VPS_BASE_URL: config.isLocalDev ? '' : config.apiUrl,
        VITE_PUBLIC_SENTRY_DSN: process.env.VITE_PUBLIC_SENTRY_DSN ?? '',
        VITE_PUBLIC_SENTRY_ENVIRONMENT: config.stage,
        VITE_PUBLIC_SENTRY_RELEASE: process.env.SENTRY_RELEASE ?? '',
        VITE_SPOTIFY_CLIENT_ID: spotifyClientId
      }
    })
  })
