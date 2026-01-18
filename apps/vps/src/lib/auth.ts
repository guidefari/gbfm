import { sendPasswordResetEmail, sendWelcomeEmail } from '@gbfm/email/index'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { admin, bearer } from 'better-auth/plugins'
import { Effect } from 'effect'

import { db } from '@/db'
import * as authSchema from '@/db/auth.schema'
import {
  EMAIL_DELIVERY_STATUSES,
  EMAIL_NOTIFICATION_TYPES
} from '@/db/email.schema'
import { env } from '@/env'
import {
  createEmailDeliveryLog,
  markEmailDeliveryLogAsFailed,
  markEmailDeliveryLogAsSent
} from '@/repositories/email-delivery-log.repository'
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
    sendOnSignUp: false,
    sendVerificationEmail: async ({ user, url }) => {
      Effect.logInfo('[Auth] Verification email requested', {
        userId: user.id,
        email: user.email,
        verificationUrl: url
      }).pipe(Effect.runPromise)
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
  trustedOrigins: [
    env.FRONTEND_URL,
    'http://localhost:5173',
    'http://localhost:3003',
    'https://www.goosebumps.fm',
    'https://goosebumps.fm'
  ],
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  basePath: '/auth',
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          const subject = `Welcome to goosebumps.fm, ${user.name}! 🎵`
          const welcomeEmailLog = await createEmailDeliveryLog({
            userId: user.id,
            recipientEmail: user.email,
            recipientName: user.name,
            emailType: EMAIL_NOTIFICATION_TYPES.TRANSACTIONAL,
            templateName: 'welcome',
            subject,
            status: EMAIL_DELIVERY_STATUSES.PENDING
          })

          try {
            await sendWelcomeEmail({
              to: user.email,
              username: user.name,
              loginUrl: `${env.FRONTEND_URL}/auth/signin`
            })
            await markEmailDeliveryLogAsSent(welcomeEmailLog.id)
          } catch (emailError) {
            Effect.logError('[Auth] Failed to send welcome email', {
              userId: user.id,
              email: user.email,
              emailLogId: welcomeEmailLog.id,
              error:
                emailError instanceof Error
                  ? emailError.message
                  : 'Unknown error'
            }).pipe(Effect.runPromise)
            await markEmailDeliveryLogAsFailed(
              welcomeEmailLog.id,
              emailError instanceof Error ? emailError.message : 'Unknown error'
            )
          }
        }
      }
    }
  },
  plugins: [
    bearer(),
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
