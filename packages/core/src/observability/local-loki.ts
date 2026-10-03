export interface LocalRequestLog {
  readonly service: 'www' | 'api'
  readonly method: string
  readonly route: string
  readonly requestId: string
  readonly status: number
  readonly durationMs: number
}

export async function writeLocalRequestLog(
  log: LocalRequestLog,
  endpoint = 'http://127.0.0.1:3100/loki/api/v1/push',
): Promise<void> {
  try {
    await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        streams: [
          {
            stream: { service_name: `goosebumps-fm-${log.service}`, environment: 'local' },
            values: [
              [
                `${BigInt(Date.now()) * 1_000_000n}`,
                JSON.stringify({
                  operation: 'request.completed',
                  method: log.method,
                  route: log.route,
                  requestId: log.requestId,
                  status: log.status,
                  durationMs: log.durationMs,
                }),
              ],
            ],
          },
        ],
      }),
      signal: AbortSignal.timeout(1_000),
    })
  } catch {
    // Local log delivery must not change a request's result when Loki is unavailable.
  }
}

export function submitLocalRequestLog(
  log: LocalRequestLog,
  waitUntil?: (delivery: Promise<void>) => void,
): void {
  const delivery = writeLocalRequestLog(log)

  if (waitUntil) waitUntil(delivery)
  else void delivery
}
