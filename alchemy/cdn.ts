import * as Cloudflare from 'alchemy/Cloudflare'
import * as Effect from 'effect/Effect'
import { hostname, type StageConfig } from './stage'
import type { Storage } from './storage'

export const cdnRouter = (config: StageConfig, store: Storage) =>
  Effect.gen(function* () {
    return yield* Cloudflare.Worker('CdnRouter', {
      main: './apps/cdn-router/src/index.ts',
      ...hostname(config, 'cdn.goosebumps.fm'),
      compatibility: { date: '2026-08-09' },
      env: {
        USER_CONTENT: store.userContent,
        MIXES: store.mixes
      }
    })
  })
