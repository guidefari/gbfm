import { Api } from '@gbfm/api/api'
import { AuthSession } from '@gbfm/api/middleware/auth'
import { Effect } from 'effect'
import { HttpServerRequest } from 'effect/unstable/http'
import { HttpApiBuilder, HttpApiError } from 'effect/unstable/httpapi'
import { auth } from '@/lib/auth'
import { dieOnDatabaseError as makeDieOnDatabaseError } from '@/http/handler-utils'
import { QRCodeService } from '@/services/qrcode.service'
import { ShowService, ShowSubscriptionService } from '@/services/show.service'

const dieOnDatabaseError = makeDieOnDatabaseError('shows')

// getAllShows uses the old Hono attachSessionContext middleware, which sets
// user context if a session cookie is present but never rejects the
// request otherwise -- unlike AuthMiddleware, which 401s when there's no
// session. Read the session directly here to preserve that optional-auth
// behavior instead of forcing this one endpoint through the required-auth
// middleware.
const getOptionalAdminFlag = Effect.gen(function* () {
  const request = yield* HttpServerRequest.HttpServerRequest
  const session = yield* Effect.tryPromise({
    try: () => auth.api.getSession({ headers: new Headers(request.headers) }),
    catch: () => null as null
  }).pipe(Effect.catch(() => Effect.succeed(null)))

  return session?.user.role === 'admin'
})

export const ShowsHandlersLive = HttpApiBuilder.group(Api, 'shows', (handlers) =>
  handlers
    .handle('getAllShows', ({ query }) =>
      Effect.gen(function* () {
        const isAdmin = yield* getOptionalAdminFlag
        const svc = yield* ShowService
        const result = yield* dieOnDatabaseError(
          svc.getAll({
            limit: query.limit ?? 20,
            offset: query.offset ?? 0,
            includeDrafts: isAdmin
          })
        )

        return {
          data: result.data.map((show) => ({
            ...show,
            createdAt: show.createdAt.toISOString(),
            updatedAt: show.updatedAt.toISOString()
          })),
          pagination: result.pagination
        }
      })
    )
    .handle('getShowBySlug', ({ params }) =>
      Effect.gen(function* () {
        const svc = yield* ShowService
        const show = yield* dieOnDatabaseError(
          svc
            .getBySlug(params.slug)
            .pipe(Effect.catchTag('NotFoundError', () => new HttpApiError.NotFound()))
        )

        return {
          ...show,
          createdAt: show.createdAt.toISOString(),
          updatedAt: show.updatedAt.toISOString()
        }
      })
    )
    .handle('createShow', ({ payload }) =>
      Effect.gen(function* () {
        const { user } = yield* AuthSession
        const { hostIds, tags, ...showData } = payload
        const finalHostIds = hostIds?.length ? [...hostIds] : [user.id]

        const svc = yield* ShowService
        const show = yield* dieOnDatabaseError(
          svc
            .create({ ...showData, tags: tags ? [...tags] : undefined }, finalHostIds)
            .pipe(Effect.catchTag('ConflictError', () => new HttpApiError.Conflict()))
        )

        return {
          ...show,
          createdAt: show.createdAt.toISOString(),
          updatedAt: show.updatedAt.toISOString()
        }
      })
    )
    .handle('updateShowBySlug', ({ params, payload }) =>
      Effect.gen(function* () {
        const { user } = yield* AuthSession
        const { hostIds, tags, ...updateData } = payload
        const svc = yield* ShowService
        const show = yield* dieOnDatabaseError(
          svc
            .update(params.slug, user.id, user.role ?? 'user', {
              ...updateData,
              ...(tags && { tags: [...tags] }),
              ...(hostIds && { hostIds: [...hostIds] })
            })
            .pipe(
              Effect.catchTag('NotFoundError', () => new HttpApiError.NotFound()),
              Effect.catchTag('UnauthorizedError', () => new HttpApiError.Unauthorized())
            )
        )

        return {
          ...show,
          createdAt: show.createdAt.toISOString(),
          updatedAt: show.updatedAt.toISOString()
        }
      })
    )
    .handle('deleteShowBySlug', ({ params }) =>
      Effect.gen(function* () {
        const { user } = yield* AuthSession
        const svc = yield* ShowService
        yield* dieOnDatabaseError(
          svc.delete(params.slug, user.id, user.role ?? 'user').pipe(
            Effect.catchTag('NotFoundError', () => new HttpApiError.NotFound()),
            Effect.catchTag('UnauthorizedError', () => new HttpApiError.Unauthorized())
          )
        )
      })
    )
    .handle('getShowEpisodes', ({ params, query }) =>
      Effect.gen(function* () {
        const svc = yield* ShowService
        const result = yield* dieOnDatabaseError(
          svc
            .getEpisodes(params.slug, { limit: query.limit ?? 20, offset: query.offset ?? 0 })
            .pipe(Effect.catchTag('NotFoundError', () => new HttpApiError.NotFound()))
        )

        return {
          data: result.data.map((episode) => ({
            ...episode,
            createdAt: episode.createdAt.toISOString(),
            updatedAt: episode.updatedAt.toISOString()
          })),
          pagination: result.pagination
        }
      })
    )
    .handle('subscribeToShow', ({ params }) =>
      Effect.gen(function* () {
        const { user } = yield* AuthSession
        const svc = yield* ShowSubscriptionService
        const subscription = yield* dieOnDatabaseError(
          svc
            .subscribe(user.id, params.id)
            .pipe(Effect.catchTag('ConflictError', () => new HttpApiError.Conflict()))
        )

        return {
          ...subscription,
          createdAt: subscription.createdAt.toISOString()
        }
      })
    )
    .handle('unsubscribeFromShow', ({ params }) =>
      Effect.gen(function* () {
        const { user } = yield* AuthSession
        const svc = yield* ShowSubscriptionService
        yield* dieOnDatabaseError(
          svc
            .unsubscribe(user.id, params.id)
            .pipe(Effect.catchTag('NotFoundError', () => new HttpApiError.NotFound()))
        )
      })
    )
    .handle('getShowQRPdf', ({ params, query }) =>
      Effect.gen(function* () {
        const showSvc = yield* ShowService
        const qrSvc = yield* QRCodeService
        const show = yield* dieOnDatabaseError(
          showSvc
            .getBySlug(params.slug)
            .pipe(Effect.catchTag('NotFoundError', () => new HttpApiError.NotFound()))
        )

        return yield* dieOnDatabaseError(
          qrSvc.generateShowQRPdf(
            {
              slug: show.slug,
              title: show.title,
              thumbnailUrl: show.thumbnailUrl,
              hosts: show.hosts
            },
            query.force === 'true'
          )
        )
      })
    )
)
