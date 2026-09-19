import * as Cloudflare from 'alchemy/Cloudflare'
import * as Effect from 'effect/Effect'
import type { StageConfig } from './stage'
import type { Storage } from './storage'
import { workerObservability } from './observability'

/** Deploys the single rasterization boundary for site-wide social images. */
export const socialImageWorker = (config: StageConfig, store: Storage, api: Cloudflare.Worker) =>
  Effect.gen(function* () {
    return yield* Cloudflare.Worker('SocialImage', {
      main: './apps/social-image/src/worker.ts',
      workersDev: false,
      compatibility: { date: '2026-07-04', flags: ['nodejs_compat'] },
      crons: ['17 3 * * *'],
      observability: workerObservability(config.isProduction),
      assets: {
        directory: './apps/social-image/assets',
        runWorkerFirst: true,
        htmlHandling: 'none',
        notFoundHandling: 'none'
      },
      env: {
        API: api,
        CARDS: store.socialCards
      }
    })
  })

/** Deployed social image Worker binding type. */
export type SocialImageWorker = Effect.Success<ReturnType<typeof socialImageWorker>>
