import type { AnalyticsEngineDataset, Fetcher, RateLimit } from '@cloudflare/workers-types'

import type { Principal } from './lib/auth/principal'

declare global {
  namespace App {
    interface Platform {
      readonly env: {
        readonly API: Fetcher
        readonly SOCIAL_IMAGES: Fetcher
        readonly BROWSER_TELEMETRY: AnalyticsEngineDataset
        readonly BROWSER_TELEMETRY_RATE_LIMIT: RateLimit
        readonly APP_STAGE: string
        readonly APP_RELEASE: string
        readonly VITE_SPOTIFY_CLIENT_ID: string
      }
    }

    interface Locals {
      principal: Principal
      requestId: string
    }
  }
}
