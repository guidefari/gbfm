import { Schema } from 'effect'
import { HttpApiEndpoint, HttpApiGroup } from 'effect/unstable/httpapi'
import { AuthMiddleware } from './middleware/auth'

// No production client calls this. It exists to validate AuthMiddleware in
// isolation -- cookie reading, session decoding, the 401 path -- before any
// real authed route (step 4+) depends on it (docs/migration-effect-http-api.md).
export const WhoamiResponse = Schema.Struct({
  userId: Schema.String,
  email: Schema.String
})
export type WhoamiResponse = typeof WhoamiResponse.Type

export const InternalGroup = HttpApiGroup.make('internal')
  .add(
    HttpApiEndpoint.get('whoami', '/api/internal/whoami', {
      success: WhoamiResponse
    })
  )
  .middleware(AuthMiddleware)
