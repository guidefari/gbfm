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
export type LogAttributes = Readonly<Record<string, LogValue>> | Readonly<{ error: unknown }>
export type LogSeverity = 'debug' | 'info' | 'warn' | 'error'

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
