import { decodeBrowserTelemetryBatch, MAX_BODY_BYTES } from './contract'

/** Analytics Engine's write-only browser telemetry binding. */
export type BrowserTelemetryDataset = {
  readonly writeDataPoint: (point: {
    readonly indexes: ReadonlyArray<string>
    readonly blobs: ReadonlyArray<string>
    readonly doubles: ReadonlyArray<number>
  }) => void
}

/** Cloudflare's native rate-limit binding. */
export type BrowserTelemetryRateLimit = {
  readonly limit: (input: { readonly key: string }) => Promise<{ readonly success: boolean }>
}

/** Environment required by the browser telemetry Web handler. */
export type BrowserTelemetryEnv = {
  readonly APP_STAGE: string
  readonly APP_RELEASE: string
  readonly BROWSER_TELEMETRY_ORIGIN: string
  readonly BROWSER_TELEMETRY: BrowserTelemetryDataset
  readonly BROWSER_TELEMETRY_RATE_LIMIT: BrowserTelemetryRateLimit
}

async function readLimitedBody(request: Request): Promise<string | null> {
  if (!request.body) return ''
  const reader = request.body.getReader()
  const decoder = new TextDecoder()
  let bytes = 0
  let result = ''

  while (true) {
    const chunk = await reader.read()

    if (chunk.done) break
    bytes += chunk.value.byteLength

    if (bytes > MAX_BODY_BYTES) {
      await reader.cancel()

      return null
    }

    result += decoder.decode(chunk.value, { stream: true })
  }

  return result + decoder.decode()
}

function browserFamily(userAgent: string): string {
  if (/Edg\//.test(userAgent)) return 'edge'

  if (/Firefox\//.test(userAgent)) return 'firefox'

  if (/Chrome\//.test(userAgent)) return 'chrome'

  if (/Safari\//.test(userAgent)) return 'safari'

  return 'other'
}

/** Handles browser telemetry using only Web APIs and explicit Cloudflare capabilities. */
export async function handleBrowserTelemetry(
  request: Request,
  env: BrowserTelemetryEnv,
): Promise<Response> {
  if (request.method !== 'POST') return new Response(null, { status: 405 })

  if (request.headers.get('origin') !== env.BROWSER_TELEMETRY_ORIGIN)
    return new Response(null, { status: 403 })

  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json'))
    return new Response(null, { status: 415 })

  // The address is used only as an ephemeral native counter key and is never persisted.
  const rateKey = request.headers.get('cf-connecting-ip') ?? 'unknown'

  if (!(await env.BROWSER_TELEMETRY_RATE_LIMIT.limit({ key: rateKey })).success)
    return new Response(null, { status: 429 })

  const body = await readLimitedBody(request)

  if (body === null) return new Response(null, { status: 413 })

  try {
    const decoded: unknown = JSON.parse(body)
    const batch = decodeBrowserTelemetryBatch(decoded)

    if (batch.release !== env.APP_RELEASE) return new Response(null, { status: 400 })
    const browser = browserFamily(request.headers.get('user-agent') ?? '')

    for (const event of batch.events) {
      env.BROWSER_TELEMETRY.writeDataPoint({
        indexes: [event.kind],
        blobs: [
          env.APP_RELEASE,
          env.APP_STAGE,
          event.kind,
          event.name,
          event.route,
          browser,
          batch.session,
        ],
        doubles: ['value' in event ? (event.value ?? 0) : 0, batch.sampleRate],
      })
    }
  } catch {
    return new Response(null, { status: 400 })
  }

  return new Response(null, { status: 204 })
}
