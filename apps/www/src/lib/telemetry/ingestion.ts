import { decodeBrowserTelemetryBatch, MAX_BODY_BYTES } from './contract'

export type AnalyticsPoint = {
  readonly indexes: Array<string>
  readonly blobs: Array<string>
  readonly doubles: Array<number>
}

export type BrowserTelemetryIngestion = {
  readonly stage: string
  readonly release: string
  readonly write: (point: AnalyticsPoint) => void
  /** Optional platform adapter. False means the request is rate limited. */
  readonly allow?: (request: Request) => boolean | Promise<boolean>
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

export async function ingestBrowserTelemetry(
  request: Request,
  dependencies: BrowserTelemetryIngestion,
): Promise<Response> {
  const expectedOrigin = new URL(request.url).origin

  if (request.headers.get('origin') !== expectedOrigin) return new Response(null, { status: 403 })

  if (dependencies.allow && !(await dependencies.allow(request)))
    return new Response(null, { status: 429 })

  const body = await readLimitedBody(request)

  if (body === null) return new Response(null, { status: 413 })

  try {
    const batch = decodeBrowserTelemetryBatch(JSON.parse(body))

    if (batch.release !== dependencies.release) return new Response(null, { status: 400 })

    const browser = browserFamily(request.headers.get('user-agent') ?? '')

    for (const event of batch.events) {
      dependencies.write({
        indexes: [event.kind],
        blobs: [
          batch.release,
          dependencies.stage,
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
