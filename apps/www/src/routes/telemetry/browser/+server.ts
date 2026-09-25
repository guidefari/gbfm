import { Schema } from 'effect'
import type { RequestHandler } from './$types'

const BrowserEvent = Schema.Struct({
  kind: Schema.Literals(['navigation', 'web-vital', 'ui-error', 'player']),
  name: Schema.String,
  value: Schema.optional(Schema.Number),
  route: Schema.optional(Schema.String)
})

export const POST: RequestHandler = async ({ platform, request }) => {
  const contentLength = Number(request.headers.get('content-length') ?? '0')
  if (contentLength > 2048) return new Response(null, { status: 413 })

  let event: typeof BrowserEvent.Type
  try {
    event = Schema.decodeUnknownSync(BrowserEvent)(await request.json())
  } catch {
    return new Response(null, { status: 400 })
  }

  const route = event.route?.startsWith('/') ? event.route.slice(0, 200) : ''
  platform?.env.BROWSER_TELEMETRY?.writeDataPoint({
    indexes: [event.kind],
    blobs: [event.name.slice(0, 100), route, platform.env.APP_STAGE],
    doubles: [event.value ?? 0]
  })

  return new Response(null, { status: 204 })
}
