import * as Cloudflare from 'alchemy/Cloudflare'
import * as Effect from 'effect/Effect'
import { workerObservability } from './observability'
import { hostname, type StageConfig } from './stage'
import type { Storage } from './storage'

export const cdnRouter = (config: StageConfig, store: Storage) =>
  Effect.gen(function* () {
    return yield* Cloudflare.Worker('CdnRouter', {
      main: './apps/cdn-router/src/index.ts',
      ...hostname(config, 'cdn.goosebumps.fm'),
      compatibility: { date: '2026-07-04' },
      observability: workerObservability(config.isProduction),
      env: {
        USER_CONTENT: store.userContent,
        MIXES: store.mixes,
        IMAGES: Cloudflare.Images.Images('IMAGES')
      }
    })
  })

export type CdnRouter = Effect.Success<ReturnType<typeof cdnRouter>>
