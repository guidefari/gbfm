import * as Cloudflare from 'alchemy/Cloudflare'
import * as Effect from 'effect/Effect'
import { hostname, type StageConfig } from './stage'

export const website = (config: StageConfig) =>
  Effect.gen(function* () {
    return yield* Cloudflare.Website.StaticSite('Www', {
      cwd: 'apps/www',
      command: 'bun run build',
      outdir: 'dist',
      ...hostname(config, ['www.goosebumps.fm', 'goosebumps.fm']),
      assets: { notFoundHandling: 'single-page-application' },
      env: {
        VITE_VPS_BASE_URL: config.apiUrl,
        VITE_PUBLIC_SENTRY_DSN: process.env.VITE_PUBLIC_SENTRY_DSN ?? '',
        VITE_PUBLIC_SENTRY_ENVIRONMENT: config.stage,
        VITE_PUBLIC_SENTRY_RELEASE: process.env.SENTRY_RELEASE ?? '',
        VITE_SPOTIFY_CLIENT_ID: process.env.SPOTIFY_CLIENT_ID ?? ''
      }
    })
  })
