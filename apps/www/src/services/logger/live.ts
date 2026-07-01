import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import * as Sentry from '@sentry/react'
import { Logger, type LogAttributes, type LogSeverity } from './service'

const serializeError = (error: unknown): Record<string, unknown> =>
  error instanceof Error
    ? { name: error.name, message: error.message, stack: error.stack }
    : { value: String(error) }

const normalizeAttributes = (attributes?: LogAttributes): LogAttributes | undefined => {
  if (attributes === undefined) return undefined
  if (attributes.error === undefined) return attributes
  const { error, ...rest } = attributes
  return { ...rest, error: serializeError(error) }
}

const writeConsole = (severity: LogSeverity, message: string, attributes?: LogAttributes) => {
  switch (severity) {
    case 'debug':
      attributes === undefined ? console.debug(message) : console.debug(message, attributes)
      return
    case 'info':
      attributes === undefined ? console.info(message) : console.info(message, attributes)
      return
    case 'warn':
      attributes === undefined ? console.warn(message) : console.warn(message, attributes)
      return
    case 'error':
      attributes === undefined ? console.error(message) : console.error(message, attributes)
      return
  }
}

const writeSentry = (severity: LogSeverity, message: string, attributes?: LogAttributes) => {
  switch (severity) {
    case 'debug':
      Sentry.logger.debug(message, attributes)
      return
    case 'info':
      Sentry.logger.info(message, attributes)
      return
    case 'warn':
      Sentry.logger.warn(message, attributes)
      return
    case 'error':
      Sentry.logger.error(message, attributes)
      return
  }
}

export const dispatchLog = (severity: LogSeverity, message: string, attributes?: LogAttributes) => {
  writeConsole(severity, message, attributes)
  writeSentry(severity, message, normalizeAttributes(attributes))
}

export const log = (severity: LogSeverity, message: string, attributes?: LogAttributes) =>
  dispatchLog(severity, message, attributes)

export const LoggerLive = Layer.sync(Logger, () => ({
  log: (severity: LogSeverity, message: string, attributes?: LogAttributes) =>
    Effect.sync(() => log(severity, message, attributes))
}))
