import { Api } from '@gbfm/api/api'
import { HttpApiScalar } from 'effect/unstable/httpapi'

// Replaces apps/server/src/lib/configure-open-api.ts (Hono + @scalar/hono-api-reference,
// deleted alongside the rest of the Hono app in this step). HttpApiScalar.layer
// generates the OpenAPI document from the real Api contract and embeds it
// directly into the reference page -- no separate /doc JSON endpoint, matching
// docs/migration-effect-http-api.md's Phase 5 plan ("HttpApiScalar.layer(Api)
// serves a docs UI (replaces configure-open-api.ts)"). better-auth's own
// endpoints are not included in this generated spec (the old
// configure-open-api.ts manually stitched auth.api's route metadata into the
// document; better-auth has no Effect-native equivalent to hook into here) --
// acceptable scope reduction for an internal docs page, not a production
// contract.
export const DocsLive = HttpApiScalar.layer(Api, {
  path: '/reference',
  scalar: {
    theme: 'kepler',
    layout: 'classic'
  }
})
