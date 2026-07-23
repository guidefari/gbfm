import { Api } from '@gbfm/api/api'
import { AuthSession } from '@gbfm/api/middleware/auth'
import { Effect } from 'effect'
import { HttpApiBuilder, HttpApiError } from 'effect/unstable/httpapi'
import { dieOnDatabaseError as makeDieOnDatabaseError } from '@/http/handler-utils'
import { LabelService } from '@/services/label.service'

const dieOnDatabaseError = makeDieOnDatabaseError('label')

const toDateStrings = <T extends { createdAt: Date; updatedAt: Date }>(label: T) => ({
  ...label,
  createdAt: label.createdAt.toISOString(),
  updatedAt: label.updatedAt.toISOString()
})

export const LabelHandlersLive = HttpApiBuilder.group(Api, 'label', (handlers) =>
  handlers
    .handle('createLabel', ({ payload }) =>
      Effect.gen(function* () {
        const { user } = yield* AuthSession
        const { creatorIds, ...labelData } = payload
        const finalCreatorIds = creatorIds?.length ? [...creatorIds] : [user.id]

        const svc = yield* LabelService
        const label = yield* dieOnDatabaseError(
          svc
            .create(
              {
                ...labelData,
                tags: labelData.tags ? [...labelData.tags] : undefined,
                genres: labelData.genres ? [...labelData.genres] : undefined
              },
              finalCreatorIds
            )
            .pipe(Effect.catchTag('ConflictError', () => new HttpApiError.Conflict()))
        )

        return toDateStrings(label)
      })
    )
    .handle('getAllLabels', ({ query }) =>
      Effect.gen(function* () {
        const svc = yield* LabelService
        const result = yield* dieOnDatabaseError(
          svc.getAll({ limit: query.limit ?? 20, offset: query.offset ?? 0 })
        )

        return {
          data: result.data.map(toDateStrings),
          pagination: result.pagination
        }
      })
    )
    .handle('getLabelsForEdit', ({ query }) =>
      Effect.gen(function* () {
        const { user } = yield* AuthSession
        const svc = yield* LabelService
        const result = yield* dieOnDatabaseError(
          svc.getAllForEdit(
            { limit: query.limit ?? 20, offset: query.offset ?? 0 },
            user.id,
            user.role ?? 'user'
          )
        )
        return { data: result.data.map(toDateStrings), pagination: result.pagination }
      })
    )
    .handle('getLabelBySlug', ({ params }) =>
      Effect.gen(function* () {
        const svc = yield* LabelService
        const label = yield* dieOnDatabaseError(
          svc
            .getBySlug(params.slug)
            .pipe(Effect.catchTag('NotFoundError', () => new HttpApiError.NotFound()))
        )

        return toDateStrings(label)
      })
    )
    .handle('getLabelBySlugForEdit', ({ params }) =>
      Effect.gen(function* () {
        const { user } = yield* AuthSession
        const svc = yield* LabelService
        const label = yield* dieOnDatabaseError(
          svc.getBySlugForEdit(params.slug, user.id, user.role ?? 'user').pipe(
            Effect.catchTag('NotFoundError', () => new HttpApiError.NotFound()),
            Effect.catchTag('UnauthorizedError', () => new HttpApiError.Unauthorized())
          )
        )
        return toDateStrings(label)
      })
    )
    .handle('updateLabelBySlug', ({ params, payload }) =>
      Effect.gen(function* () {
        const { user } = yield* AuthSession
        const { tags, genres, ...updateData } = payload

        const svc = yield* LabelService
        const label = yield* dieOnDatabaseError(
          svc
            .update(params.slug, user.id, user.role ?? 'user', {
              ...updateData,
              ...(tags && { tags: [...tags] }),
              ...(genres && { genres: [...genres] })
            })
            .pipe(
              Effect.catchTag('NotFoundError', () => new HttpApiError.NotFound()),
              Effect.catchTag('UnauthorizedError', () => new HttpApiError.Unauthorized())
            )
        )

        return toDateStrings(label)
      })
    )
)
