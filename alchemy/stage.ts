import * as Alchemy from 'alchemy'
import * as Effect from 'effect/Effect'

export const localDevPorts = {
  api: 3003,
  cdn: 3004,
  qrPdf: 3005,
} as const

export interface StageConfig {
  readonly stage: string
  readonly release: string
  readonly isProduction: boolean
  readonly isLocalDev: boolean
  readonly apiUrl: string
}

export const stageConfig = Effect.gen(function* () {
  const stack = yield* Alchemy.Stack
  const isProduction = stack.stage === 'prod'
  const isLocalDev = yield* Alchemy.ALCHEMY_DEV
  const release = process.env.APP_RELEASE ?? process.env.SENTRY_RELEASE ?? 'local'

  if (isProduction && release === 'local') {
    return yield* Effect.die(new Error('APP_RELEASE is required for production deployments'))
  }

  return {
    stage: stack.stage,
    release,
    isProduction,
    isLocalDev,
    apiUrl: isProduction ? 'https://api.goosebumps.fm' : `https://api.${stack.stage}.goosebumps.fm`,
  } satisfies StageConfig
})

export const hostname = (config: StageConfig, domain: string) =>
  config.isProduction ? { domain } : { url: true as const }
