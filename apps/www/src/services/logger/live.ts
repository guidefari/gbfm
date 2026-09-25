export type LogValue =
  | string
  | number
  | boolean
  | bigint
  | null
  | undefined
  | Error
  | ReadonlyArray<LogValue>
  | { readonly [key: string]: LogValue }

export type LogAttributes = Readonly<Record<string, LogValue>> | Readonly<{ error: unknown }>

export type LogSeverity = 'debug' | 'info' | 'warn' | 'error'

const write = (severity: LogSeverity, message: string, attributes?: LogAttributes) => {
  globalThis.console[severity](message, attributes ?? {})
}

export const log = (severity: LogSeverity, message: string, attributes?: LogAttributes) =>
  write(severity, message, attributes)
