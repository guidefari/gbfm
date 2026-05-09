import { sendPasswordResetEmail, sendWelcomeEmail } from '@gbfm/email/index'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { admin, bearer, username } from 'better-auth/plugins'
import { Effect } from 'effect'

import { db } from '@/db'
import * as authSchema from '@/db/auth.schema'
import {
  EMAIL_DELIVERY_STATUSES,
  EMAIL_NOTIFICATION_TYPES
} from '@/db/email.schema'
import { createEmailDeliveryLog } from '@/repositories/email-delivery-log.repository'
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
    sendResetPassword: async ({ user, url }) => {
      sendPasswordResetEmail({
        to: user.email,
        resetUrl: url,
        expiresIn: '1 hour'
      }).catch(async (err: Error) => {
        const { runAppFork } = await import('@/runtime')
        runAppFork(
          Effect.logError('[Auth] Failed to send password reset email', {
            userId: user.id,
            email: user.email,
            error: err.message
          })
        )
      })
    }
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, token }) => {
      const callbackURL = `${config.urls.frontend}/`
      const verificationUrl = `${config.urls.frontend}/auth/verify-email?token=${encodeURIComponent(token)}&callbackURL=${encodeURIComponent(callbackURL)}`

      const baseLogFields = {
        userId: user.id,
        recipientEmail: user.email,
        recipientName: user.name,
        emailType: EMAIL_NOTIFICATION_TYPES.TRANSACTIONAL,
        templateName: 'welcome-verify',
        subject: `Welcome to goosebumps.fm, ${user.name}, verify your email`
      }

      try {
        await sendWelcomeEmail({
          to: user.email,
          username: user.name,
          verificationUrl
        })
        await createEmailDeliveryLog({
          ...baseLogFields,
          status: EMAIL_DELIVERY_STATUSES.SENT,
          sentAt: new Date()
        })
      } catch (cause) {
        const errorMessage =
          cause instanceof Error ? cause.message : String(cause)
        await createEmailDeliveryLog({
          ...baseLogFields,
          status: EMAIL_DELIVERY_STATUSES.FAILED,
          errorMessage
        })
      }
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
