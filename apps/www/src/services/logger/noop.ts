import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import { Logger, type LogAttributes, type LogSeverity } from './service'

const noop = (_severity: LogSeverity, _message: string, _attributes?: LogAttributes) => Effect.void

export const NoopLogger = Layer.succeed(Logger, {
  log: noop
})
