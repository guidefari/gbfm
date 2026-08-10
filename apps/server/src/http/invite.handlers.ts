import { Api } from '@gbfm/api/api'
import { AuthSession } from '@gbfm/api/middleware/auth'
import { buildInviteEmail } from '@gbfm/email/index'
import { eq } from 'drizzle-orm'
import { Effect, Result } from 'effect'
import { HttpServerResponse } from 'effect/unstable/http'
import { HttpApiBuilder, HttpApiError } from 'effect/unstable/httpapi'
import { user as usersTable, verification } from '@/db/auth.schema'
import { Database } from '@/db/layer'
import { EMAIL_NOTIFICATION_TYPES } from '@/db/email.schema'
import { DatabaseError, getErrorMessage } from '@/errors'
import { dieOnDatabaseError as makeDieOnDatabaseError } from '@/http/handler-utils'
import { Auth } from '@/lib/auth'
import { ConfigService } from '@/services/config.service'
import { EmailDelivery } from '@/services/email-delivery.service'

const dieOnDatabaseError = makeDieOnDatabaseError('invite')

function generateToken(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  const bytes = crypto.getRandomValues(new Uint8Array(length))
  return Array.from(bytes, (byte) => chars[byte % chars.length]).join('')
}

const requireAdmin = Effect.gen(function* () {
  const { user } = yield* AuthSession
  if (user.role !== 'admin') return yield* new HttpApiError.Forbidden()
})

export const InviteHandlersLive = HttpApiBuilder.group(Api, 'invite', (handlers) =>
  handlers
    .handle('sendInvite', ({ payload }) =>
      Effect.gen(function* () {
        yield* requireAdmin
        const { user: currentUser } = yield* AuthSession
        const db = yield* Database
        const [targetUser] = yield* dieOnDatabaseError(
          Effect.tryPromise({
            try: () =>
              db.select().from(usersTable).where(eq(usersTable.id, payload.userId)).limit(1),
            catch: (cause) =>
              new DatabaseError({
                message: `Failed to look up invite target user: ${getErrorMessage(cause)}`,
                operation: 'select',
                table: 'user'
              })
          })
        )
        if (!targetUser) return yield* new HttpApiError.NotFound()

        const token = generateToken(24)
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        yield* dieOnDatabaseError(
          Effect.tryPromise({
            try: () =>
              db.insert(verification).values({
                id: crypto.randomUUID(),
                identifier: `reset-password:${token}`,
                value: targetUser.id,
                expiresAt
              }),
            catch: (cause) =>
              new DatabaseError({
                message: `Failed to create invite verification record: ${getErrorMessage(cause)}`,
                operation: 'insert',
                table: 'verification'
              })
          })
        )

        const config = yield* ConfigService
        const delivery = yield* EmailDelivery
        const deliveryResult = yield* Effect.result(
          Effect.gen(function* () {
            const message = yield* buildInviteEmail({
              to: targetUser.email,
              name: targetUser.name,
              inviteUrl: `${config.urls.frontend}/auth/reset-password?token=${token}`,
              role: targetUser.role ?? 'user'
            })
            return yield* delivery.deliver({
              message,
              emailType: EMAIL_NOTIFICATION_TYPES.TRANSACTIONAL,
              userId: targetUser.id,
              recipientName: targetUser.name,
              safeMetadata: { kind: 'invite', invitedBy: currentUser.id }
            })
          })
        )

        if (Result.isFailure(deliveryResult)) {
          yield* Effect.logWarning('[invite] failed to deliver invite email', {
            userId: targetUser.id,
            failure: deliveryResult.failure._tag
          })
          return yield* new HttpApiError.InternalServerError()
        }

        return { success: true, emailId: deliveryResult.success.deliveryLogId }
      })
    )
    .handle('confirmInvite', ({ payload }) =>
      Effect.gen(function* () {
        const auth = yield* Auth
        const db = yield* Database
        const { token, password } = payload
        const identifier = `reset-password:${token}`
        const [verificationRecord] = yield* dieOnDatabaseError(
          Effect.tryPromise({
            try: () =>
              db
                .select()
                .from(verification)
                .where(eq(verification.identifier, identifier))
                .limit(1),
            catch: (cause) =>
              new DatabaseError({
                message: `Failed to look up invite verification record: ${getErrorMessage(cause)}`,
                operation: 'select',
                table: 'verification'
              })
          })
        )
        if (!verificationRecord || verificationRecord.expiresAt < new Date()) {
          return yield* new HttpApiError.BadRequest()
        }

        const [targetUser] = yield* dieOnDatabaseError(
          Effect.tryPromise({
            try: () =>
              db
                .select()
                .from(usersTable)
                .where(eq(usersTable.id, verificationRecord.value))
                .limit(1),
            catch: (cause) =>
              new DatabaseError({
                message: `Failed to look up invite target user: ${getErrorMessage(cause)}`,
                operation: 'select',
                table: 'user'
              })
          })
        )
        if (!targetUser) return yield* new HttpApiError.BadRequest()

        const resetResult = yield* Effect.tryPromise(() =>
          auth.api.resetPassword({ body: { token, newPassword: password } })
        ).pipe(Effect.catch(() => Effect.succeed({ status: false })))
        if (!resetResult.status) return yield* new HttpApiError.BadRequest()

        const signInResult = yield* Effect.tryPromise(() =>
          auth.api.signInEmail({
            body: { email: targetUser.email, password },
            returnHeaders: true
          })
        ).pipe(Effect.catch(() => Effect.succeed(null)))
        if (!signInResult) return yield* new HttpApiError.BadRequest()

        const setCookieHeader = signInResult.headers.get('set-cookie')
        const response = yield* HttpServerResponse.json({ success: true }).pipe(Effect.orDie)
        return setCookieHeader
          ? HttpServerResponse.setHeader(response, 'set-cookie', setCookieHeader)
          : response
      })
    )
)
