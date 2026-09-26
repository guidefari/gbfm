import * as Cloudflare from 'alchemy/Cloudflare'
import * as Effect from 'effect/Effect'

import { privateSourceMaps, workerObservability } from './observability'
import { localDevPorts, type StageConfig } from './stage'
import type { Storage } from './storage'

export const cdnRouter = (config: StageConfig, store: Storage) =>
  Effect.gen(function* () {
    return yield* Cloudflare.Worker('CdnRouter', {
      main: './apps/cdn-router/src/index.ts',
      ...(config.isProduction
        ? {
            domain: {
              name: 'cdn.goosebumps.fm',
              aliases: ['cdn.dev.goosebumps.fm'],
            },
          }
        : { url: true as const }),
      ...(config.isLocalDev ? { dev: { port: localDevPorts.cdn, strictPort: true } } : undefined),
      compatibility: { date: '2026-07-04' },
      build: privateSourceMaps,
      observability: workerObservability(config.isProduction),
      env: {
        APP_RELEASE: config.release,
        USER_CONTENT: store.userContent,
        MIXES: store.mixes,
        IMAGES: Cloudflare.Images.Images('IMAGES'),
      },
    })
  })

export type CdnRouter = Effect.Success<ReturnType<typeof cdnRouter>>
