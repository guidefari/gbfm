import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import { Logger, type LogAttributes, type LogSeverity } from './service'

const write = (severity: LogSeverity, message: string, attributes?: LogAttributes) => {
  const method =
    severity === 'debug'
      ? console.debug
      : severity === 'info'
        ? console.info
        : severity === 'warn'
          ? console.warn
          : console.error
  method(message, attributes ?? {})
}

export const log = (severity: LogSeverity, message: string, attributes?: LogAttributes) =>
  write(severity, message, attributes)

export const dispatchLog = (severity: LogSeverity, message: string, attributes?: LogAttributes) =>
  Effect.sync(() => write(severity, message, attributes))

export const LoggerLive = Layer.succeed(Logger, { log: dispatchLog })
