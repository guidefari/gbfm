import * as Context from 'effect/Context'
import type * as Effect from 'effect/Effect'

export type LogAttributes = Record<string, unknown>
export type LogSeverity = 'debug' | 'info' | 'warn' | 'error'

export interface LoggerShape {
  readonly log: (
    severity: LogSeverity,
    message: string,
    attributes?: LogAttributes
  ) => Effect.Effect<void>
}

export class Logger extends Context.Service<Logger, LoggerShape>()('@gbfm/www/Logger') {}
