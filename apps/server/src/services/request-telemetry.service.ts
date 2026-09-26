import { Context, Effect, Layer } from 'effect'

export interface RequestTelemetryPoint {
  readonly method: string
  readonly route: string
  readonly status: number
  readonly durationMs: number
}

export interface RequestTelemetryWriter {
  readonly writeDataPoint: (point: {
    readonly indexes: Array<string>
    readonly blobs: Array<string>
    readonly doubles: Array<number>
  }) => void
}

export interface RequestTelemetry {
  readonly release: string
  readonly stage: string
  readonly record: (point: RequestTelemetryPoint) => Effect.Effect<void>
}

export const RequestTelemetry = Context.Service<RequestTelemetry>('RequestTelemetry')

export const RequestTelemetryUnavailableLayer = Layer.succeed(RequestTelemetry, {
  release: 'local',
  stage: 'local',
  record: () => Effect.void,
})

export const RequestTelemetryLive = (input: {
  readonly release: string
  readonly stage: string
  readonly writer: RequestTelemetryWriter
}) =>
  Layer.succeed(RequestTelemetry, {
    release: input.release,
    stage: input.stage,
    record: (point) =>
      Effect.sync(() =>
        input.writer.writeDataPoint({
          indexes: ['request'],
          blobs: [input.release, input.stage, point.method, point.route, 'api'],
          doubles: [point.durationMs, point.status],
        }),
      ),
  })
