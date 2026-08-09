import { EMAIL_DELIVERY_STATUSES } from '@gbfm/core/status'
import {
  sendNewUserNotificationEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail
} from '@gbfm/email/index'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { admin, bearer, username } from 'better-auth/plugins'
import { Context, Effect, Layer } from 'effect'
import * as authSchema from '@/db/auth.schema'
import { Database, type DatabaseClient } from '@/db/layer'
import { EMAIL_NOTIFICATION_TYPES } from '@/db/email.schema'
import { createEmailDeliveryLog } from '@/repositories/email-delivery-log.repository'
import {
  getOrCreateEmailPreferencesByUserId,
  updateEmailPreferences
} from '@/repositories/email-preferences.repository'
import { linkOrCreateSubscriberForUser } from '@/repositories/newsletter.repository'
import { config } from '@/services/config.service'
import { ac, admin as adminRole, creator, editor, userRole } from './auth-permissions'

const makeAuth = (database: DatabaseClient) =>
  betterAuth({
    database: drizzleAdapter(database, {
      provider: 'sqlite',
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
          await createEmailDeliveryLog(
            {
              ...baseLogFields,
              status: EMAIL_DELIVERY_STATUSES.SENT,
              sentAt: new Date()
            },
            database
          )
        } catch (cause) {
          const errorMessage = cause instanceof Error ? cause.message : String(cause)
          await createEmailDeliveryLog(
            {
              ...baseLogFields,
              status: EMAIL_DELIVERY_STATUSES.FAILED,
              errorMessage
            },
            database
          )
        }
      }
    },
    databaseHooks: {
      user: {
        create: {
          after: async (createdUser) => {
            try {
              const { previouslyUnsubscribed } = await linkOrCreateSubscriberForUser(
                {
                  userId: createdUser.id,
                  email: createdUser.email,
                  name: createdUser.name
                },
                database
              )

              await getOrCreateEmailPreferencesByUserId(createdUser.id, database)

              if (previouslyUnsubscribed) {
                await updateEmailPreferences(
                  createdUser.id,
                  {
                    globalUnsubscribe: true,
                    mixReleaseEnabled: false,
                    promotionalEnabled: false,
                    systemEnabled: false
                  },
                  database
                )
              }
            } catch (err) {
              const { runAppFork } = await import('@/runtime')
              runAppFork(
                Effect.logError('[Auth] Failed to link newsletter subscription on signup', {
                  userId: createdUser.id,
                  email: createdUser.email,
                  error: err instanceof Error ? err.message : String(err)
                })
              )
            }

            try {
              await sendNewUserNotificationEmail({
                to: config.adminEmail,
                name: createdUser.name,
                email: createdUser.email,
                timestamp: new Date().toISOString()
              })
            } catch (err) {
              const { runAppFork } = await import('@/runtime')
              runAppFork(
                Effect.logError('[Auth] Failed to send new user admin notification', {
                  userId: createdUser.id,
                  email: createdUser.email,
                  error: err instanceof Error ? err.message : String(err)
                })
              )
            }
          }
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
      'http://127.0.0.1:5173',
      'http://localhost:5173',
      'http://127.0.0.1:3003',
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
        displayUsernameNormalization: (displayUsername) => displayUsername.toLowerCase()
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

export class Auth extends Context.Service<Auth, ReturnType<typeof makeAuth>>()('Auth') {}

export const AuthLive = Layer.effect(
  Auth,
  Effect.gen(function* () {
    const database = yield* Database
    return Auth.of(makeAuth(database))
  })
)

export type AuthSession = ReturnType<typeof makeAuth>['$Infer']['Session']
