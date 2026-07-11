import { eq } from 'drizzle-orm'
import { Effect, Schema } from 'effect'
import { HttpRouter, HttpServerRequest, HttpServerResponse } from 'effect/unstable/http'
import { db } from '@/db'
import { user as usersTable, verification } from '@/db/auth.schema'
import { DatabaseError, getErrorMessage } from '@/errors'
import { dieOnDatabaseError as makeDieOnDatabaseError } from '@/http/handler-utils'
import { auth } from '@/lib/auth'

const dieOnDatabaseError = makeDieOnDatabaseError('invite')

const ConfirmInviteBody = Schema.Struct({
  token: Schema.String,
  password: Schema.String
})

const errorResponse = (message: string, status: number) =>
  HttpServerResponse.json({ error: message }, { status })

// Not an HttpApiEndpoint -- see packages/api/src/invite.ts's comment on
// InviteGroup for why: this handler must forward better-auth's set-cookie
// header onto the real response, and only a raw HttpRouter route (like
// betterAuthRoute in routes.ts) can do that; HttpApiBuilder.group handlers
// only ever return the raw decoded success value with no header access.
export const confirmInviteRoute = HttpRouter.add('POST', '/api/invite/confirm', (request) =>
  Effect.gen(function* () {
    const body = yield* HttpServerRequest.schemaBodyJson(ConfirmInviteBody).pipe(
      Effect.catchTag('SchemaError', () => Effect.succeed(null)),
      Effect.catchTag('HttpServerError', () => Effect.succeed(null))
    )

    if (!body) {
      return yield* errorResponse('Invalid request body', 400)
    }

    const { token, password } = body
    const identifier = `reset-password:${token}`

    const [verificationRecord] = yield* dieOnDatabaseError(
      Effect.tryPromise({
        try: () =>
          db.select().from(verification).where(eq(verification.identifier, identifier)).limit(1),
        catch: (error) =>
          new DatabaseError({
            message: `Failed to look up invite verification record: ${getErrorMessage(error)}`,
            operation: 'select',
            table: 'verification'
          })
      })
    )

    if (!verificationRecord || verificationRecord.expiresAt < new Date()) {
      return yield* errorResponse('Invalid or expired invite link', 400)
    }

    const userId = verificationRecord.value

    const [targetUser] = yield* dieOnDatabaseError(
      Effect.tryPromise({
        try: () => db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1),
        catch: (error) =>
          new DatabaseError({
            message: `Failed to look up invite target user: ${getErrorMessage(error)}`,
            operation: 'select',
            table: 'user'
          })
      })
    )

    if (!targetUser) {
      return yield* errorResponse('User not found', 400)
    }

    const resetResult = yield* Effect.tryPromise(() =>
      auth.api.resetPassword({ body: { token, newPassword: password } })
    ).pipe(Effect.catch(() => Effect.succeed({ status: false })))

    if (!resetResult.status) {
      return yield* errorResponse('Failed to reset password', 500)
    }

    const signInResult = yield* Effect.tryPromise(() =>
      auth.api.signInEmail({
        body: { email: targetUser.email, password },
        returnHeaders: true
      })
    ).pipe(Effect.catch(() => Effect.succeed(null)))

    if (!signInResult) {
      return yield* errorResponse('Failed to reset password', 500)
    }

    const setCookieHeader = signInResult.headers.get('set-cookie')
    const response = yield* HttpServerResponse.json({ success: true })

    return setCookieHeader
      ? HttpServerResponse.setHeader(response, 'set-cookie', setCookieHeader)
      : response
  }).pipe(Effect.catch(() => errorResponse('Failed to confirm invite', 500)))
)
