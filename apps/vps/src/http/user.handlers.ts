import { isFormDataFile } from '@gbfm/core/utils'
import { Api } from '@gbfm/api/api'
import { AuthSession } from '@gbfm/api/middleware/auth'
import { Effect } from 'effect'
import { HttpApiBuilder, HttpApiError } from 'effect/unstable/httpapi'
import { dieOnDatabaseError as makeDieOnDatabaseError } from '@/http/handler-utils'
import { ShowSubscriptionService } from '@/services/show.service'
import { UserService } from '@/services/user.service'
import { uploadAvatar } from '@/routes/user/user.util'

const dieOnDatabaseError = makeDieOnDatabaseError('user')

const requireAdmin = Effect.gen(function* () {
  const { user: sessionUser } = yield* AuthSession
  if (sessionUser.role !== 'admin') {
    return yield* new HttpApiError.Forbidden()
  }
})

type UserProfile = Effect.Success<ReturnType<UserService['getUserById']>>
type SocialLink = Effect.Success<ReturnType<UserService['getUserSocialLinks']>>[number]

const toProfileResponse = (profile: UserProfile, socialLinks: ReadonlyArray<SocialLink>) => ({
  ...profile,
  avatarUrl: profile.image,
  verified: profile.emailVerified,
  socialLinks: [...socialLinks]
})

export const UserHandlersLive = HttpApiBuilder.group(Api, 'user', (handlers) =>
  handlers
    .handle('updateProfile', ({ payload }) =>
      Effect.gen(function* () {
        const { user } = yield* AuthSession
        const updateData: {
          email?: string
          image?: string | null
          username?: string
          bio?: string | null
        } = {}

        // Both branches of the payload union (JSON and multipart) share the
        // same email/username/bio fields; `avatar`/`image` only exist on one
        // side each, so a plain `in` check picks the right one at runtime --
        // HttpApiBuilder already routed us here based on the real
        // content-type header, so this isn't re-deriving that decision.
        if (payload.email) updateData.email = payload.email
        if (payload.username) updateData.username = payload.username
        if (payload.bio !== undefined) updateData.bio = payload.bio
        if ('image' in payload && payload.image !== undefined) updateData.image = payload.image

        if ('avatar' in payload && payload.avatar && isFormDataFile(payload.avatar)) {
          const avatarFile = payload.avatar
          updateData.image = yield* Effect.promise(() => uploadAvatar(avatarFile))
        }

        const svc = yield* UserService
        const [profile, socialLinks] = yield* dieOnDatabaseError(
          Effect.all([
            svc
              .updateUserProfile(user.id, updateData)
              .pipe(Effect.catchTag('NotFoundError', () => new HttpApiError.NotFound())),
            svc
              .getUserSocialLinks(user.id)
              .pipe(Effect.catchTag('NotFoundError', () => new HttpApiError.NotFound()))
          ])
        )

        return toProfileResponse(profile, socialLinks)
      })
    )
    .handle('getProfile', () =>
      Effect.gen(function* () {
        const { user } = yield* AuthSession
        const svc = yield* UserService
        const [profile, socialLinks] = yield* dieOnDatabaseError(
          Effect.all([
            svc
              .getUserById(user.id)
              .pipe(Effect.catchTag('NotFoundError', () => new HttpApiError.NotFound())),
            svc
              .getUserSocialLinks(user.id)
              .pipe(Effect.catchTag('NotFoundError', () => new HttpApiError.NotFound()))
          ])
        )

        return toProfileResponse(profile, socialLinks)
      })
    )
    .handle('getSocialLinks', () =>
      Effect.gen(function* () {
        const { user } = yield* AuthSession
        const svc = yield* UserService
        const links = yield* dieOnDatabaseError(
          svc
            .getUserSocialLinks(user.id)
            .pipe(Effect.catchTag('NotFoundError', () => new HttpApiError.NotFound()))
        )
        return [...links]
      })
    )
    .handle('replaceSocialLinks', ({ payload }) =>
      Effect.gen(function* () {
        const { user } = yield* AuthSession
        const svc = yield* UserService
        const links = yield* dieOnDatabaseError(
          svc
            .replaceUserSocialLinks(user.id, [...payload])
            .pipe(Effect.catchTag('NotFoundError', () => new HttpApiError.NotFound()))
        )
        return [...links]
      })
    )
    .handle('getAdminUserSocialLinks', ({ params }) =>
      Effect.gen(function* () {
        yield* requireAdmin
        const svc = yield* UserService
        const links = yield* dieOnDatabaseError(
          svc
            .getUserSocialLinks(params.userId)
            .pipe(Effect.catchTag('NotFoundError', () => new HttpApiError.NotFound()))
        )
        return [...links]
      })
    )
    .handle('replaceAdminUserSocialLinks', ({ params, payload }) =>
      Effect.gen(function* () {
        yield* requireAdmin
        const svc = yield* UserService
        const links = yield* dieOnDatabaseError(
          svc
            .replaceUserSocialLinks(params.userId, [...payload])
            .pipe(Effect.catchTag('NotFoundError', () => new HttpApiError.NotFound()))
        )
        return [...links]
      })
    )
    .handle('updateAdminUserBio', ({ params, payload }) =>
      Effect.gen(function* () {
        yield* requireAdmin
        const updateData: { bio?: string | null; image?: string | null } = {}
        if (payload.bio !== null) updateData.bio = payload.bio
        if (payload.image !== undefined) updateData.image = payload.image

        const svc = yield* UserService
        const updated = yield* dieOnDatabaseError(
          svc
            .updateUserProfile(params.userId, updateData)
            .pipe(Effect.catchTag('NotFoundError', () => new HttpApiError.NotFound()))
        )
        return { bio: updated.bio }
      })
    )
    .handle('getAdminUserBio', ({ params }) =>
      Effect.gen(function* () {
        yield* requireAdmin
        const svc = yield* UserService
        const target = yield* dieOnDatabaseError(
          svc
            .getUserById(params.userId)
            .pipe(Effect.catchTag('NotFoundError', () => new HttpApiError.NotFound()))
        )
        return { bio: target.bio }
      })
    )
    .handle('getEmailPreferences', () =>
      Effect.gen(function* () {
        const { user } = yield* AuthSession
        const svc = yield* UserService
        const prefs = yield* dieOnDatabaseError(svc.getUserEmailPreferences(user.id))
        return {
          ...prefs,
          createdAt: prefs.createdAt.toISOString(),
          updatedAt: prefs.updatedAt.toISOString()
        }
      })
    )
    .handle('updateEmailPreferences', ({ payload }) =>
      Effect.gen(function* () {
        const { user } = yield* AuthSession
        const svc = yield* UserService
        const prefs = yield* dieOnDatabaseError(svc.updateUserEmailPreferences(user.id, payload))
        return {
          ...prefs,
          createdAt: prefs.createdAt.toISOString(),
          updatedAt: prefs.updatedAt.toISOString()
        }
      })
    )
    .handle('getUserSubscriptions', ({ query }) =>
      Effect.gen(function* () {
        const { user } = yield* AuthSession
        const svc = yield* ShowSubscriptionService
        const result = yield* dieOnDatabaseError(
          svc.getUserSubscriptions(user.id, {
            limit: query.limit ?? 20,
            offset: query.offset ?? 0
          })
        )

        return {
          data: result.data.map((subscription) => ({
            ...subscription,
            createdAt: subscription.createdAt.toISOString(),
            show: {
              ...subscription.show,
              createdAt: subscription.show.createdAt.toISOString(),
              updatedAt: subscription.show.updatedAt.toISOString()
            }
          })),
          pagination: result.pagination
        }
      })
    )
    .handle('listDjs', () =>
      Effect.gen(function* () {
        const svc = yield* UserService
        return yield* dieOnDatabaseError(svc.listDjs())
      })
    )
    .handle('searchUsers', ({ query }) =>
      Effect.gen(function* () {
        const svc = yield* UserService
        return yield* dieOnDatabaseError(svc.searchUsers(query.q))
      })
    )
)
