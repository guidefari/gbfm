import { Api } from '@gbfm/api/api'
import { AuthSession } from '@gbfm/api/middleware/auth'
import { Effect } from 'effect'
import { HttpApiBuilder, HttpApiError } from 'effect/unstable/httpapi'
import { dieOnDatabaseError as makeDieOnDatabaseError } from '@/http/handler-utils'
import { ReleaseService } from '@/services/release.service'

const dieOnDatabaseError = makeDieOnDatabaseError('release')

const toReleaseResponse = <
  T extends { createdAt: Date; updatedAt: Date; releaseDate: Date | null }
>(
  release: T
) => ({
  ...release,
  createdAt: release.createdAt.toISOString(),
  updatedAt: release.updatedAt.toISOString(),
  releaseDate: release.releaseDate ? release.releaseDate.toISOString() : null
})

export const ReleaseHandlersLive = HttpApiBuilder.group(Api, 'release', (handlers) =>
  handlers
    .handle('createRelease', ({ payload }) =>
      Effect.gen(function* () {
        const { user } = yield* AuthSession
        const { tags, streamingLinks, ...releaseData } = payload

        const svc = yield* ReleaseService
        const release = yield* dieOnDatabaseError(
          svc
            .create(
              {
                ...releaseData,
                tags: tags ? [...tags] : undefined,
                streamingLinks: streamingLinks ? [...streamingLinks] : undefined,
                releaseDate: new Date(payload.releaseDate)
              },
              user.id,
              user.role ?? 'user'
            )
            .pipe(
              Effect.catchTag('ConflictError', () => new HttpApiError.Conflict()),
              Effect.catchTag('NotFoundError', () => new HttpApiError.NotFound()),
              Effect.catchTag('UnauthorizedError', () => new HttpApiError.Unauthorized())
            )
        )

        return toReleaseResponse(release)
      })
    )
    .handle('getReleaseBySlug', ({ params }) =>
      Effect.gen(function* () {
        const svc = yield* ReleaseService
        const release = yield* dieOnDatabaseError(
          svc
            .getBySlug(params.slug)
            .pipe(Effect.catchTag('NotFoundError', () => new HttpApiError.NotFound()))
        )

        return toReleaseResponse(release)
      })
    )
    .handle('getReleaseBySlugForEdit', ({ params }) =>
      Effect.gen(function* () {
        const { user } = yield* AuthSession
        const svc = yield* ReleaseService
        const release = yield* dieOnDatabaseError(
          svc.getBySlugForEdit(params.slug, user.id, user.role ?? 'user').pipe(
            Effect.catchTag('NotFoundError', () => new HttpApiError.NotFound()),
            Effect.catchTag('UnauthorizedError', () => new HttpApiError.Unauthorized())
          )
        )
        return toReleaseResponse(release)
      })
    )
    .handle('updateReleaseBySlug', ({ params, payload }) =>
      Effect.gen(function* () {
        const { user } = yield* AuthSession
        const { tags, streamingLinks, releaseDate, ...updateData } = payload

        const svc = yield* ReleaseService
        const release = yield* dieOnDatabaseError(
          svc
            .update(params.slug, user.id, user.role ?? 'user', {
              ...updateData,
              ...(tags && { tags: [...tags] }),
              ...(streamingLinks && { streamingLinks: [...streamingLinks] }),
              ...(releaseDate && { releaseDate: new Date(releaseDate) })
            })
            .pipe(
              Effect.catchTag('NotFoundError', () => new HttpApiError.NotFound()),
              Effect.catchTag('UnauthorizedError', () => new HttpApiError.Unauthorized())
            )
        )

        return toReleaseResponse(release)
      })
    )
    .handle('deleteReleaseBySlug', ({ params }) =>
      Effect.gen(function* () {
        const { user } = yield* AuthSession
        const svc = yield* ReleaseService
        yield* dieOnDatabaseError(
          svc.delete(params.slug, user.id, user.role ?? 'user').pipe(
            Effect.catchTag('NotFoundError', () => new HttpApiError.NotFound()),
            Effect.catchTag('UnauthorizedError', () => new HttpApiError.Unauthorized())
          )
        )

        return { message: 'Release deleted successfully' }
      })
    )
)
