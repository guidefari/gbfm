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

// confirmInvite's handler returns a raw HttpServerResponse to carry
// better-auth's set-cookie header (see invite.handlers.ts).
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
