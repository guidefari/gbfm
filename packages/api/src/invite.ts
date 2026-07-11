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

export const ConfirmInviteInput = Schema.Struct({
  token: Schema.String,
  password: Schema.String
})
export type ConfirmInviteInput = typeof ConfirmInviteInput.Type

export const ConfirmInviteResponse = Schema.Struct({
  success: Schema.Boolean
})

// confirmInvite's handler must forward better-auth's set-cookie header from
// auth.api.signInEmail so the browser session is live before
// apps/www/src/routes/auth/reset-password.tsx's post-success
// refetchSession() call. HttpApiBuilder.group handlers CAN do this directly
// -- effect@4.0.0-beta.93's HttpApiBuilder.ts (handlerToHttpEffect) checks
// `Response.isHttpServerResponse(response)` on the handler's return value
// and short-circuits schema encoding if so, passing a handler-constructed
// HttpServerResponse straight through. The handler builds the response with
// HttpServerResponse.json + HttpServerResponse.setHeader and returns it
// directly instead of the plain ConfirmInviteResponse shape -- no separate
// raw HttpRouter route needed. (An earlier version of this endpoint was
// built as a raw, non-HttpApiEndpoint route based on the mistaken belief
// that handlers only ever return the encoded success value; corrected
// after adversarial review caught it.)
export const InviteGroup = HttpApiGroup.make('invite')
  .add(
    HttpApiEndpoint.post('sendInvite', '/api/invite/send', {
      payload: SendInviteInput,
      success: SendInviteResponse,
      error: [HttpApiError.Forbidden, HttpApiError.NotFound, HttpApiError.InternalServerError]
    }).middleware(AuthMiddleware)
  )
  .add(
    HttpApiEndpoint.post('confirmInvite', '/api/invite/confirm', {
      payload: ConfirmInviteInput,
      success: ConfirmInviteResponse,
      error: HttpApiError.BadRequest
    })
  )
