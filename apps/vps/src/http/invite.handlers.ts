import { Api } from '@gbfm/api/api'
import { AuthSession } from '@gbfm/api/middleware/auth'
import { EMAIL_DELIVERY_STATUSES } from '@gbfm/core/status'
import { sendInviteEmail } from '@gbfm/email/sender'
import { eq } from 'drizzle-orm'
import { Effect, Result } from 'effect'
import { HttpServerResponse } from 'effect/unstable/http'
import { HttpApiBuilder, HttpApiError } from 'effect/unstable/httpapi'
import { db } from '@/db'
import { user as usersTable, verification } from '@/db/auth.schema'
import { EMAIL_NOTIFICATION_TYPES } from '@/db/email.schema'
import { DatabaseError, getErrorMessage } from '@/errors'
import { dieOnDatabaseError as makeDieOnDatabaseError } from '@/http/handler-utils'
import { auth } from '@/lib/auth'
import {
  createEmailDeliveryLog,
  markEmailDeliveryLogAsFailed,
  markEmailDeliveryLogAsSent
} from '@/repositories/email-delivery-log.repository'
import { config } from '@/services/config.service'

const dieOnDatabaseError = makeDieOnDatabaseError('invite')

function generateToken(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  const bytes = crypto.getRandomValues(new Uint8Array(length))
  return Array.from(bytes, (b) => chars[b % chars.length]).join('')
}

const requireAdmin = Effect.gen(function* () {
  const { user } = yield* AuthSession
  if (user.role !== 'admin') {
    return yield* new HttpApiError.Forbidden()
  }
})

export const InviteHandlersLive = HttpApiBuilder.group(Api, 'invite', (handlers) =>
  handlers
    .handle('sendInvite', ({ payload }) =>
      Effect.gen(function* () {
        yield* requireAdmin
        const { user: currentUser } = yield* AuthSession

        const [targetUser] = yield* dieOnDatabaseError(
          Effect.tryPromise({
            try: () =>
              db.select().from(usersTable).where(eq(usersTable.id, payload.userId)).limit(1),
            catch: (error) =>
              new DatabaseError({
                message: `Failed to look up invite target user: ${getErrorMessage(error)}`,
                operation: 'select',
                table: 'user'
              })
          })
        )

        if (!targetUser) {
          return yield* new HttpApiError.NotFound()
        }

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
            catch: (error) =>
              new DatabaseError({
                message: `Failed to create invite verification record: ${getErrorMessage(error)}`,
                operation: 'insert',
                table: 'verification'
              })
          })
        )

        const inviteUrl = `${config.urls.frontend}/auth/reset-password?token=${token}`

        const deliveryLog = yield* dieOnDatabaseError(
          Effect.tryPromise({
            try: () =>
              createEmailDeliveryLog({
                userId: targetUser.id,
                recipientEmail: targetUser.email,
                recipientName: targetUser.name,
                emailType: EMAIL_NOTIFICATION_TYPES.TRANSACTIONAL,
                templateName: 'invite',
                subject: "You've been invited to goosebumps.fm",
                status: EMAIL_DELIVERY_STATUSES.PENDING,
                metadata: { invitedBy: currentUser.id }
              }),
            catch: (error) =>
              new DatabaseError({
                message: `Failed to create email delivery log: ${getErrorMessage(error)}`,
                operation: 'insert',
                table: 'email_delivery_logs'
              })
          })
        )

        const sendResult = yield* Effect.tryPromise({
          try: () =>
            sendInviteEmail({
              to: targetUser.email,
              name: targetUser.name,
              inviteUrl,
              role: targetUser.role ?? 'user'
            }),
          catch: (error) => error
        }).pipe(Effect.result)

        if (Result.isFailure(sendResult)) {
          const message = getErrorMessage(sendResult.failure)
          yield* Effect.logError('[invite] failed to send invite email', {
            userId: targetUser.id,
            email: targetUser.email,
            emailLogId: deliveryLog.id,
            error: message
          })
          yield* Effect.promise(() => markEmailDeliveryLogAsFailed(deliveryLog.id, message))
          return yield* new HttpApiError.InternalServerError()
        }

        yield* Effect.promise(() => markEmailDeliveryLogAsSent(deliveryLog.id))

        return { success: true, emailId: deliveryLog.id }
      })
    )
    .handle('confirmInvite', ({ payload }) =>
      Effect.gen(function* () {
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
            catch: (error) =>
              new DatabaseError({
                message: `Failed to look up invite verification record: ${getErrorMessage(error)}`,
                operation: 'select',
                table: 'verification'
              })
          })
        )

        if (!verificationRecord || verificationRecord.expiresAt < new Date()) {
          return yield* new HttpApiError.BadRequest()
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
          return yield* new HttpApiError.BadRequest()
        }

        const resetResult = yield* Effect.tryPromise(() =>
          auth.api.resetPassword({ body: { token, newPassword: password } })
        ).pipe(Effect.catch(() => Effect.succeed({ status: false })))

        if (!resetResult.status) {
          return yield* new HttpApiError.BadRequest()
        }

        const signInResult = yield* Effect.tryPromise(() =>
          auth.api.signInEmail({
            body: { email: targetUser.email, password },
            returnHeaders: true
          })
        ).pipe(Effect.catch(() => Effect.succeed(null)))

        if (!signInResult) {
          return yield* new HttpApiError.BadRequest()
        }

        const setCookieHeader = signInResult.headers.get('set-cookie')
        // orDie: HttpBodyError here would mean JSON.stringify({ success: true })
        // itself failed, which cannot happen for a static literal -- not a
        // real failure mode worth declaring in the endpoint's error union.
        const response = yield* HttpServerResponse.json({ success: true }).pipe(Effect.orDie)

        // Returning a raw HttpServerResponse here (instead of the plain
        // { success: true } shape) makes HttpApiBuilder.group's
        // handlerToHttpEffect short-circuit schema encoding and pass this
        // response straight through, headers included -- see the comment on
        // InviteGroup's confirmInvite endpoint in packages/api/src/invite.ts.
        return setCookieHeader
          ? HttpServerResponse.setHeader(response, 'set-cookie', setCookieHeader)
          : response
      })
    )
)
