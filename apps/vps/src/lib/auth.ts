import { sendPasswordResetEmail, sendWelcomeEmail } from '@gbfm/email/index'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { hashPassword, verifyPassword } from 'better-auth/crypto'
import { admin, bearer, username } from 'better-auth/plugins'
import { Effect } from 'effect'

import { db } from '@/db'
import * as authSchema from '@/db/auth.schema'
import {
  EMAIL_DELIVERY_STATUSES,
  EMAIL_NOTIFICATION_TYPES
} from '@/db/email.schema'
import {
  type AuthTracingError,
  getAuthTracingErrorMessage,
  getCurrentSignupTraceId,
  toAuthTracingError,
  withSignupRequestParentSpan
} from '@/lib/auth-tracing'
import { createEmailDeliveryLog } from '@/repositories/email-delivery-log.repository'
import { runApp } from '@/runtime'
import { config } from '@/services/config.service'
import {
  ac,
  admin as adminRole,
  creator,
  editor,
  userRole
} from './auth-permissions'

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: authSchema
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    password: {
      hash: async (password) => {
        const traceId = getCurrentSignupTraceId()

        const program = Effect.tryPromise({
          try: () => hashPassword(password),
          catch: (cause) =>
            toAuthTracingError('auth.signUp.hashPassword', cause)
        }).pipe(
          Effect.withSpan('auth.signUp.hashPassword', {
            attributes: {
              'auth.trace_id': traceId
            }
          })
        )

        return runApp(withSignupRequestParentSpan(program, traceId))
      },
      verify: verifyPassword
    },
    sendResetPassword: async ({ user, url }) => {
      sendPasswordResetEmail({
        to: user.email,
        resetUrl: url,
        expiresIn: '1 hour'
      }).catch((err: Error) => {
        Effect.logError('[Auth] Failed to send password reset email', {
          userId: user.id,
          email: user.email,
          error: err.message
        }).pipe(Effect.runPromise)
      })
    }
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }, request) => {
      const traceId = request?.headers.get('x-auth-trace-id') ?? undefined

      const callbackURL = `${config.urls.frontend}/auth/verify-email`
      const verificationUrl = url.includes('callbackURL=')
        ? url
        : `${url}${url.includes('?') ? '&' : '?'}callbackURL=${encodeURIComponent(callbackURL)}`

      const baseLogFields = {
        userId: user.id,
        recipientEmail: user.email,
        recipientName: user.name,
        emailType: EMAIL_NOTIFICATION_TYPES.TRANSACTIONAL,
        templateName: 'welcome-verify',
        subject: `Welcome to goosebumps.fm, ${user.name}, verify your email`
      }

      const program = Effect.gen(function* () {
        const sendWelcomeEmailProgram = Effect.tryPromise({
          try: () =>
            sendWelcomeEmail({
              to: user.email,
              username: user.name,
              verificationUrl
            }),
          catch: (cause) =>
            toAuthTracingError('auth.signUp.sendWelcomeEmail', cause)
        }).pipe(
          Effect.withSpan('auth.signUp.sendWelcomeEmail', {
            attributes: {
              'auth.trace_id': traceId,
              'auth.user.id': user.id,
              'email.template': 'welcome-verify'
            }
          })
        )

        const logSent = Effect.tryPromise({
          try: () =>
            createEmailDeliveryLog({
              ...baseLogFields,
              status: EMAIL_DELIVERY_STATUSES.SENT,
              sentAt: new Date()
            }),
          catch: (cause) =>
            toAuthTracingError('auth.signUp.createEmailDeliveryLog', cause)
        }).pipe(
          Effect.withSpan('auth.signUp.createEmailDeliveryLog', {
            attributes: {
              'auth.trace_id': traceId,
              'auth.user.id': user.id,
              'email.template': 'welcome-verify',
              'email.delivery.status': EMAIL_DELIVERY_STATUSES.SENT
            }
          })
        )

        const logFailed = (error: AuthTracingError) =>
          Effect.tryPromise({
            try: () =>
              createEmailDeliveryLog({
                ...baseLogFields,
                status: EMAIL_DELIVERY_STATUSES.FAILED,
                errorMessage: getAuthTracingErrorMessage(error)
              }),
            catch: (cause) =>
              toAuthTracingError('auth.signUp.createEmailDeliveryLog', cause)
          }).pipe(
            Effect.withSpan('auth.signUp.createEmailDeliveryLog', {
              attributes: {
                'auth.trace_id': traceId,
                'auth.user.id': user.id,
                'email.template': 'welcome-verify',
                'email.delivery.status': EMAIL_DELIVERY_STATUSES.FAILED,
                'error.message': getAuthTracingErrorMessage(error)
              }
            })
          )

        yield* sendWelcomeEmailProgram.pipe(
          Effect.matchEffect({
            onSuccess: () => logSent,
            onFailure: logFailed
          })
        )
      }).pipe(
        Effect.withSpan('auth.signUp.sendVerificationEmail', {
          attributes: {
            'auth.trace_id': traceId,
            'auth.user.id': user.id,
            'auth.user.email': user.email
          }
        })
      )

      await runApp(withSignupRequestParentSpan(program, traceId))
    }
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60 // 5 minutes
    }
  },
  advanced: {
    backgroundTasks: {
      handler: (promise) => {
        void promise.catch(() => {})
      }
    }
  },
  trustedOrigins: [
    config.urls.frontend,
    'http://localhost:5173',
    'http://localhost:3003',
    'https://www.goosebumps.fm',
    'https://goosebumps.fm'
  ],
  secret: config.auth.betterAuthSecret,
  baseURL: config.auth.betterAuthUrl,
  basePath: '/auth',
  plugins: [
    bearer(),
    username({
      displayUsernameNormalization: (displayUsername) =>
        displayUsername.toLowerCase()
    }),
    admin({
      ac,
      roles: {
        admin: adminRole,
        editor,
        creator,
        user: userRole
      }
    })
  ]
})

export type AuthSession = typeof auth.$Infer.Session
