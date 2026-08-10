import {
  buildNewUserNotificationEmail,
  buildPasswordResetEmail,
  buildWelcomeEmail,
  type EmailRenderError,
  type RenderedEmail
} from '@gbfm/email/index'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { admin, bearer, username } from 'better-auth/plugins'
import { Clock, Context, Effect, Layer } from 'effect'
import * as authSchema from '@/db/auth.schema'
import { Database, type DatabaseClient } from '@/db/layer'
import { EMAIL_NOTIFICATION_TYPES } from '@/db/email.schema'
import {
  getOrCreateEmailPreferencesByUserId,
  updateEmailPreferences
} from '@/repositories/email-preferences.repository'
import { linkOrCreateSubscriberForUser } from '@/repositories/newsletter.repository'
import { ConfigService, type ConfigService as Config } from '@/services/config.service'
import {
  type DeliveryRequest,
  EmailDelivery,
  type EmailDeliveryError,
  type EmailDeliveryReceipt,
  type EmailDeliveryService
} from '@/services/email-delivery.service'
import { ac, admin as adminRole, creator, editor, userRole } from './auth-permissions'

const deliverBuiltEmail = (
  message: Effect.Effect<RenderedEmail, EmailRenderError>,
  request: Omit<DeliveryRequest, 'message'>,
  delivery: EmailDeliveryService
): Effect.Effect<EmailDeliveryReceipt, EmailRenderError | EmailDeliveryError> =>
  Effect.gen(function* () {
    const rendered = yield* message
    return yield* delivery.deliver({ ...request, message: rendered })
  })

const makeAuth = (
  database: DatabaseClient,
  config: Config,
  delivery: EmailDeliveryService,
  nowIso: () => Promise<string>
) =>
  betterAuth({
    database: drizzleAdapter(database, { provider: 'sqlite', schema: authSchema }),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
      sendResetPassword: async ({ user, url }) => {
        await Effect.runPromise(
          deliverBuiltEmail(
            buildPasswordResetEmail({ to: user.email, resetUrl: url, expiresIn: '1 hour' }),
            { emailType: EMAIL_NOTIFICATION_TYPES.TRANSACTIONAL, userId: user.id },
            delivery
          )
        )
      }
    },
    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, token }) => {
        const callbackURL = `${config.urls.frontend}/`
        const verificationUrl = `${config.urls.frontend}/auth/verify-email?token=${encodeURIComponent(token)}&callbackURL=${encodeURIComponent(callbackURL)}`

        await Effect.runPromise(
          deliverBuiltEmail(
            buildWelcomeEmail({
              to: user.email,
              username: user.name,
              verificationUrl
            }),
            {
              emailType: EMAIL_NOTIFICATION_TYPES.TRANSACTIONAL,
              userId: user.id,
              recipientName: user.name
            },
            delivery
          )
        )
      }
    },
    databaseHooks: {
      user: {
        create: {
          after: async (createdUser) => {
            try {
              const { previouslyUnsubscribed } = await linkOrCreateSubscriberForUser(
                { userId: createdUser.id, email: createdUser.email, name: createdUser.name },
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
            } catch {
              console.error('[Auth] Failed to link newsletter subscription on signup', {
                userId: createdUser.id
              })
            }

            await Effect.runPromise(
              deliverBuiltEmail(
                buildNewUserNotificationEmail({
                  to: config.adminEmail,
                  name: createdUser.name,
                  email: createdUser.email,
                  timestamp: await nowIso()
                }),
                {
                  emailType: EMAIL_NOTIFICATION_TYPES.SYSTEM,
                  userId: createdUser.id,
                  recipientName: createdUser.name
                },
                delivery
              )
            ).catch(() => {
              console.error('[Auth] Failed to deliver new-user admin notification')
            })
          }
        }
      }
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
      cookieCache: { enabled: true, maxAge: 5 * 60 }
    },
    trustedOrigins: [
      config.urls.frontend,
      'http://127.0.0.1:5173',
      'http://localhost:5173',
      'http://127.0.0.1:3003',
      'http://localhost:3003',
      'https://gbfm.localhost',
      'https://gbfm.test',
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
      admin({ ac, roles: { admin: adminRole, editor, creator, user: userRole } })
    ]
  })

export class Auth extends Context.Service<Auth, ReturnType<typeof makeAuth>>()('Auth') {}

export const AuthLive = Layer.effect(
  Auth,
  Effect.gen(function* () {
    const database = yield* Database
    const config = yield* ConfigService
    const delivery = yield* EmailDelivery
    const clock = yield* Clock.Clock
    return Auth.of(
      makeAuth(database, config, delivery, () =>
        Effect.runPromise(clock.currentTimeMillis).then((milliseconds) =>
          new Date(milliseconds).toISOString()
        )
      )
    )
  })
)

export type AuthSession = ReturnType<typeof makeAuth>['$Infer']['Session']
