import { Schema } from 'effect'
import { HttpApiEndpoint, HttpApiError, HttpApiGroup } from 'effect/unstable/httpapi'
import { AuthMiddleware } from './middleware/auth'

export const SendInviteInput = Schema.Struct({
  userId: Schema.String
})
export type SendInviteInput = typeof SendInviteInput.Type

export const SendInviteResponse = Schema.Struct({
  success: Schema.Boolean,
  emailId: Schema.String
})

// confirmInvite (POST /api/invite/confirm) is deliberately NOT an
// HttpApiEndpoint -- it must forward better-auth's set-cookie header from
// auth.api.signInEmail so the browser session is live before
// apps/www/src/routes/auth/reset-password.tsx's post-success refetchSession()
// call, and HttpApiBuilder.group handlers can only return the raw decoded
// success value (no header access); only a wrapping HttpApiMiddleware or
// global HttpRouter.middleware can touch response headers, and this
// endpoint's handler is the one that knows the cookie value, not a
// middleware wrapping it. Kept as a raw HttpRouter.add route in
// apps/vps/src/http/routes.ts, the same tier as the better-auth wildcard
// route, instead of forcing it through a mechanism that can't carry the
// cookie.
export const InviteGroup = HttpApiGroup.make('invite').add(
  HttpApiEndpoint.post('sendInvite', '/api/invite/send', {
    payload: SendInviteInput,
    success: SendInviteResponse,
    error: [HttpApiError.Forbidden, HttpApiError.NotFound, HttpApiError.InternalServerError]
  }).middleware(AuthMiddleware)
)
