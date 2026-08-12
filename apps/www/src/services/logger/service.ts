import * as Context from 'effect/Context'
import type * as Effect from 'effect/Effect'
import type * as Sentry from '@sentry/react'

export type LogValue =
  | string
  | number
  | boolean
  | bigint
  | null
  | undefined
  | Error
  | readonly LogValue[]
  | { readonly [key: string]: LogValue }
export type LogAttributes =
  | Readonly<Record<string, LogValue>>
  | Readonly<{ error: Parameters<typeof Sentry.captureException>[0] }>
export type LogSeverity = 'debug' | 'info' | 'warn' | 'error'

export interface LoggerService {
  readonly log: (
    severity: LogSeverity,
    message: string,
    attributes?: LogAttributes
  ) => Effect.Effect<void>
}

export class Logger extends Context.Service<Logger, LoggerService>()('@gbfm/www/Logger') {}
