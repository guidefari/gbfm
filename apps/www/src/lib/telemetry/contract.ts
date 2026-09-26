import { Schema } from 'effect'

export const TELEMETRY_VERSION = 1 as const

export const MAX_BATCH_EVENTS = 20

export const MAX_BODY_BYTES = 16_384

const BoundedToken = Schema.String.pipe(
  Schema.check(Schema.isMinLength(1)),
  Schema.check(Schema.isMaxLength(80)),
  Schema.check(Schema.isPattern(/^[a-zA-Z0-9._:-]+$/)),
)

const RouteTemplate = Schema.String.pipe(
  Schema.check(Schema.isMinLength(1)),
  Schema.check(Schema.isMaxLength(120)),
  Schema.check(Schema.isPattern(/^\/[a-zA-Z0-9_/[\].=-]*$/)),
)

const Value = Schema.Finite.pipe(
  Schema.check(Schema.isBetween({ minimum: 0, maximum: 86_400_000 })),
)

export const BrowserTelemetryEvent = Schema.Union([
  Schema.Struct({
    kind: Schema.Literal('navigation'),
    name: Schema.Literals(['initial-load', 'spa-navigation']),
    route: RouteTemplate,
    value: Value,
  }),
  Schema.Struct({
    kind: Schema.Literal('web-vital'),
    name: Schema.Literals(['lcp', 'inp', 'cls']),
    route: RouteTemplate,
    value: Value,
  }),
  Schema.Struct({
    kind: Schema.Literal('ui-error'),
    name: Schema.String.pipe(Schema.check(Schema.isPattern(/^(?:error|rejection)\.[0-9a-f]{8}$/))),
    route: RouteTemplate,
  }),
  Schema.Struct({
    kind: Schema.Literal('player'),
    name: Schema.Literals(['play', 'pause', 'stall', 'error']),
    route: RouteTemplate,
    value: Schema.optional(Value),
  }),
])

export const BrowserTelemetryBatch = Schema.Struct({
  version: Schema.Literal(TELEMETRY_VERSION),
  session: Schema.String.pipe(
    Schema.check(Schema.isMinLength(20)),
    Schema.check(Schema.isMaxLength(64)),
    Schema.check(Schema.isPattern(/^[a-zA-Z0-9_-]+$/)),
  ),
  release: BoundedToken,
  sampleRate: Schema.Finite.pipe(
    Schema.check(Schema.isGreaterThan(0)),
    Schema.check(Schema.isLessThanOrEqualTo(1)),
  ),
  sentAt: Schema.Int.pipe(Schema.check(Schema.isGreaterThan(0))),
  events: Schema.Array(BrowserTelemetryEvent).pipe(
    Schema.check(Schema.isMinLength(1)),
    Schema.check(Schema.isMaxLength(MAX_BATCH_EVENTS)),
  ),
})

export type BrowserTelemetryEvent = typeof BrowserTelemetryEvent.Type

export type BrowserTelemetryBatch = typeof BrowserTelemetryBatch.Type

export const decodeBrowserTelemetryBatch = Schema.decodeUnknownSync(BrowserTelemetryBatch, {
  onExcessProperty: 'error',
})
