import { Effect } from 'effect'
import * as HttpStatusCodes from 'stoker/http-status-codes'
import { runEffect } from '@/lib/effect-hono'
import type { AppRouteHandler } from '@/lib/types'
import { AudioService } from '@/services/audio.service'
import { QRCodeService } from '@/services/qrcode.service'

import type {
  CreateAudioRoute,
  CreateMixRoute,
  GetAudioBySlugRoute,
  GetAudioByTypeRoute,
  GetAudioTagsRoute,
  GetMixQRPdfRoute,
  TrackAudioPlayRoute,
  UpdateAudioBySlugRoute
} from './content.routes'

export const createMix: AppRouteHandler<CreateMixRoute> = async (c) => {
  const { creatorIds, ...mixData } = c.req.valid('json')
  const user = c.get('user')
  const finalCreatorIds = creatorIds?.length ? creatorIds : [user.id]

  const program = Effect.gen(function* () {
    const audioService = yield* AudioService
    return yield* audioService.create(mixData, finalCreatorIds)
  })

  return runEffect<CreateMixRoute>(c, program, HttpStatusCodes.CREATED)
}

export const getAudioTags: AppRouteHandler<GetAudioTagsRoute> = async (c) => {
  const { type } = c.req.valid('param')

  const program = Effect.gen(function* () {
    const audioService = yield* AudioService
    return yield* audioService.getTags(type)
  }).pipe(Effect.withSpan('getAudioTags'))

  c.header('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400')
  return runEffect<GetAudioTagsRoute>(c, program)
}

export const getAudioByType: AppRouteHandler<GetAudioByTypeRoute> = async (c) => {
  const { type } = c.req.valid('param')
  const { limit, offset, tag } = c.req.valid('query')

  const program = Effect.gen(function* () {
    const audioService = yield* AudioService
    return yield* audioService.getByType(type, {
      limit,
      offset,
      tag
    })
  }).pipe(Effect.withSpan('getAudioByType'))

  c.header('Cache-Control', 'public, max-age=60, stale-while-revalidate=300')
  return runEffect<GetAudioByTypeRoute>(c, program)
}

export const getAudioBySlug: AppRouteHandler<GetAudioBySlugRoute> = async (c) => {
  const { type, slug } = c.req.valid('param')

  const program = Effect.gen(function* () {
    const audioService = yield* AudioService
    return yield* audioService.getBySlug(type, slug)
  }).pipe(Effect.withSpan('getAudioBySlug'))

  return runEffect<GetAudioBySlugRoute>(c, program)
}

export const updateAudioBySlug: AppRouteHandler<UpdateAudioBySlugRoute> = async (c) => {
  const { type, slug } = c.req.valid('param')
  const updateData = c.req.valid('json')
  const user = c.get('user')

  const program = Effect.gen(function* () {
    const audioService = yield* AudioService
    return yield* audioService.update(type, slug, user.id, user.role || 'user', updateData)
  }).pipe(Effect.withSpan('updateAudioBySlug'))

  return runEffect<UpdateAudioBySlugRoute>(c, program)
}

export const createAudio: AppRouteHandler<CreateAudioRoute> = async (c) => {
  const { creatorIds, ...audioData } = c.req.valid('json')
  const user = c.get('user')
  const finalCreatorIds = creatorIds?.length ? creatorIds : [user.id]

  const program = Effect.gen(function* () {
    const audioService = yield* AudioService
    return yield* audioService.create(audioData, finalCreatorIds)
  })

  return runEffect<CreateAudioRoute>(c, program, HttpStatusCodes.CREATED)
}

export const trackAudioPlay: AppRouteHandler<TrackAudioPlayRoute> = async (c) => {
  const { id } = c.req.valid('param')
  const clientIp =
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || c.req.header('x-real-ip') || 'unknown'

  const program = Effect.gen(function* () {
    const audioService = yield* AudioService
    return yield* audioService.trackPlay(id, clientIp)
  })

  return runEffect<TrackAudioPlayRoute>(c, program)
}

export const getMixQRPdf: AppRouteHandler<GetMixQRPdfRoute> = async (c) => {
  const { slug } = c.req.valid('param')
  const { force } = c.req.valid('query')

  const program = Effect.gen(function* () {
    const audioService = yield* AudioService
    const qrService = yield* QRCodeService
    const mix = yield* audioService.getBySlug('mix', slug)
    return yield* qrService.generateMixQRPdf(
      {
        slug: mix.slug,
        title: mix.title,
        thumbnailUrl: mix.thumbnailUrl,
        creators: mix.creators
      },
      force
    )
  })

  return runEffect<GetMixQRPdfRoute>(c, program)
}
