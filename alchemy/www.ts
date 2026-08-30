import * as Cloudflare from 'alchemy/Cloudflare'
import * as Effect from 'effect/Effect'
import * as Output from 'alchemy/Output'
import type { WebsiteConfig } from './config'
import { workerObservability } from './observability'
import type { StageConfig } from './stage'

export interface WebsiteInput {
  readonly config: StageConfig
  readonly websiteConfig: WebsiteConfig
  readonly apiUrl: Output.Output<string | undefined>
}

const requireApiUrl = (url: string | undefined) => {
  if (url === undefined) throw new Error('Api Worker URL is missing')
  return url
}

export const website = ({ config, websiteConfig, apiUrl }: WebsiteInput) =>
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
            cwd: 'apps/www'
          }
        : undefined,
      env: {
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
