import * as Alchemy from 'alchemy'
import * as Effect from 'effect/Effect'

export interface StageConfig {
  readonly stage: string
  readonly isProduction: boolean
  readonly isLocalDev: boolean
  readonly apiUrl: string
}

export const stageConfig = Effect.gen(function* () {
  const stack = yield* Alchemy.Stack
  const isProduction = stack.stage === 'prod'
  const isLocalDev = yield* Alchemy.ALCHEMY_DEV

  return {
    stage: stack.stage,
    isProduction,
    isLocalDev,
    apiUrl: isProduction ? 'https://api.goosebumps.fm' : `https://api.${stack.stage}.goosebumps.fm`
  } satisfies StageConfig
})

export const hostname = (config: StageConfig, domain: string | Array<string>) =>
  config.isProduction ? { domain } : { url: true as const }
