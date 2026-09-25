import { ingestBrowserTelemetry } from '@/lib/telemetry/ingestion'

import type { RequestHandler } from './$types'

export const POST: RequestHandler = ({ platform, request }) =>
  ingestBrowserTelemetry(request, {
    stage: platform?.env.APP_STAGE ?? 'unknown',
    release: platform?.env.APP_RELEASE ?? 'local',
    write: (point) => platform?.env.BROWSER_TELEMETRY?.writeDataPoint(point),
    allow: async (incoming) => {
      const limiter = platform?.env.BROWSER_TELEMETRY_RATE_LIMIT

      if (!limiter) return true

      // The address is used only as an ephemeral Cloudflare counter key; it is never emitted.
      const key = incoming.headers.get('cf-connecting-ip') ?? 'unknown'

      return (await limiter.limit({ key })).success
    },
  })
