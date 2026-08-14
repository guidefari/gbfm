import { Api } from '@gbfm/api/api'
import { AuthSession } from '@gbfm/api/middleware/auth'
import { GetAudioByTypeResponse, GetAudioTagsResponse } from '@gbfm/api/audio'
import { Effect, Schema } from 'effect'
import { HttpServerResponse } from 'effect/unstable/http'
import { HttpApiBuilder, HttpApiError } from 'effect/unstable/httpapi'
import {
  dieOnDatabaseError as makeDieOnDatabaseError,
  getOptionalActor
} from '@/http/handler-utils'
import { AudioService } from '@/services/audio.service'
import { QRCodeService } from '@/services/qrcode.service'

const dieOnDatabaseError = makeDieOnDatabaseError('audio')

const toDateStrings = <T extends { createdAt: Date; updatedAt: Date }>(audio: T) => ({
  ...audio,
  createdAt: audio.createdAt.toISOString(),
  updatedAt: audio.updatedAt.toISOString()
})

export const AudioHandlersLive = HttpApiBuilder.group(Api, 'audio', (handlers) =>
  handlers
    .handle('createMix', ({ payload }) =>
      Effect.gen(function* () {
        const { user } = yield* AuthSession
        const { creatorIds, idempotencyKey, ...mixData } = payload
        const finalCreatorIds = creatorIds?.length ? [...creatorIds] : [user.id]

        const svc = yield* AudioService
        const audio = yield* dieOnDatabaseError(
          svc
            .create(
              { ...mixData, tags: mixData.tags ? [...mixData.tags] : undefined },
              finalCreatorIds,
              { actorId: user.id, idempotencyKey }
            )
            .pipe(Effect.catchTag('ConflictError', () => new HttpApiError.Conflict()))
        )

        return toDateStrings(audio)
      })
    )
    .handle('getAudioTags', ({ params }) =>
      Effect.gen(function* () {
        const svc = yield* AudioService
        const tags = yield* dieOnDatabaseError(svc.getTags(params.type))
        const body = yield* Schema.encodeEffect(GetAudioTagsResponse)(tags).pipe(Effect.orDie)
        return HttpServerResponse.setHeader(
          yield* HttpServerResponse.json(body).pipe(Effect.orDie),
          'Cache-Control',
          'public, max-age=3600, stale-while-revalidate=86400'
        )
      })
    )
    .handle('getAudioByType', ({ params, query }) =>
      Effect.gen(function* () {
        const svc = yield* AudioService
        const result = yield* dieOnDatabaseError(
          svc.getByType(params.type, {
            limit: query.limit ?? 20,
            offset: query.offset ?? 0,
            tag: query.tag
          })
        )

        const body = {
          data: result.data.map(toDateStrings),
          pagination: result.pagination
        }
        const encoded = yield* Schema.encodeEffect(GetAudioByTypeResponse)(body).pipe(Effect.orDie)
        return HttpServerResponse.setHeader(
          yield* HttpServerResponse.json(encoded).pipe(Effect.orDie),
          'Cache-Control',
          'public, max-age=60, stale-while-revalidate=300'
        )
      })
    )
    .handle('getAudioByTypeForEdit', ({ params, query }) =>
      Effect.gen(function* () {
        const { user } = yield* AuthSession
        const svc = yield* AudioService
        const result = yield* dieOnDatabaseError(
          svc.getByTypeForEdit(
            params.type,
            {
              limit: query.limit ?? 20,
              offset: query.offset ?? 0,
              tag: query.tag,
              sort: query.sort,
              order: query.order
            },
            user.id,
            user.role ?? 'user'
          )
        )
        return {
          data: result.data.map(toDateStrings),
          pagination: result.pagination
        }
      })
    )
    .handle('getAudioBySlug', ({ params }) =>
      Effect.gen(function* () {
        const actor = yield* getOptionalActor
        const svc = yield* AudioService
        const audio = yield* dieOnDatabaseError(
          svc
            .getBySlug(params.type, params.slug, actor)
            .pipe(Effect.catchTag('NotFoundError', () => new HttpApiError.NotFound()))
        )

        return toDateStrings(audio)
      })
    )
    .handle('getAudioBySlugForEdit', ({ params }) =>
      Effect.gen(function* () {
        const { user } = yield* AuthSession
        const svc = yield* AudioService
        const audio = yield* dieOnDatabaseError(
          svc.getBySlugForEdit(params.type, params.slug, user.id, user.role || 'user').pipe(
            Effect.catchTag('NotFoundError', () => new HttpApiError.NotFound()),
            Effect.catchTag('UnauthorizedError', () => new HttpApiError.Unauthorized())
          )
        )

        return toDateStrings(audio)
      })
    )
    .handle('updateAudioBySlug', ({ params, payload }) =>
      Effect.gen(function* () {
        const { user } = yield* AuthSession
        const { tags, creatorIds, ...updateData } = payload

        const svc = yield* AudioService
        const audio = yield* dieOnDatabaseError(
          svc
            .update(params.type, params.slug, user.id, user.role || 'user', {
              ...updateData,
              ...(tags && { tags: [...tags] }),
              ...(creatorIds && { creatorIds: [...creatorIds] })
            })
            .pipe(
              Effect.catchTag('NotFoundError', () => new HttpApiError.NotFound()),
              Effect.catchTag('UnauthorizedError', () => new HttpApiError.Unauthorized())
            )
        )

        return toDateStrings(audio)
      })
    )
    .handle('createAudio', ({ payload }) =>
      Effect.gen(function* () {
        const { user } = yield* AuthSession
        const { creatorIds, idempotencyKey, ...audioData } = payload
        const finalCreatorIds = creatorIds?.length ? [...creatorIds] : [user.id]

        const svc = yield* AudioService
        const audio = yield* dieOnDatabaseError(
          svc
            .create(
              { ...audioData, tags: audioData.tags ? [...audioData.tags] : undefined },
              finalCreatorIds,
              { actorId: user.id, idempotencyKey }
            )
            .pipe(Effect.catchTag('ConflictError', () => new HttpApiError.Conflict()))
        )

        return toDateStrings(audio)
      })
    )
    .handle('trackAudioPlay', ({ params, request }) =>
      Effect.gen(function* () {
        const forwardedFor = request.headers['x-forwarded-for']
        const clientIp =
          forwardedFor?.split(',')[0]?.trim() || request.headers['x-real-ip'] || 'unknown'

        const svc = yield* AudioService
        return yield* dieOnDatabaseError(
          svc
            .trackPlay(params.id, clientIp)
            .pipe(Effect.catchTag('NotFoundError', () => new HttpApiError.NotFound()))
        )
      })
    )
    .handle('getMixQRPdf', ({ params, query }) =>
      Effect.gen(function* () {
        const actor = yield* getOptionalActor
        const audioSvc = yield* AudioService
        const qrSvc = yield* QRCodeService
        const mix = yield* dieOnDatabaseError(
          audioSvc
            .getBySlug('mix', params.slug, actor)
            .pipe(Effect.catchTag('NotFoundError', () => new HttpApiError.NotFound()))
        )

        return yield* dieOnDatabaseError(
          qrSvc.generateMixQRPdf(
            {
              slug: mix.slug,
              title: mix.title,
              thumbnailUrl: mix.thumbnailUrl,
              creators: mix.creators
            },
            query.force === 'true'
          )
        )
      })
    )
)
