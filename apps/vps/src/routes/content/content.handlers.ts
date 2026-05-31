import { Effect } from 'effect'
import * as HttpStatusCodes from 'stoker/http-status-codes'
import { runEffect } from '@/lib/effect-hono'
import type { AppRouteHandler } from '@/lib/types'
import { AudioService } from '@/services/audio.service'
import { PostService } from '@/services/post.service'
import { QRCodeService } from '@/services/qrcode.service'

import type {
  CreateAudioRoute,
  CreateMixRoute,
  CreatePostRoute,
  GetAudioBySlugRoute,
  GetAudioByTypeRoute,
  GetAudioTagsRoute,
  GetEditorialPostBySlugRoute,
  GetEditorialPostsRoute,
  GetEditorialTagsRoute,
  GetMicroPostBySlugRoute,
  GetMicroPostsRoute,
  GetMixQRPdfRoute,
  GetPostBySlugRoute,
  GetPostsByTagRoute,
  GetPostsRoute,
  TrackAudioPlayRoute,
  UpdateAudioBySlugRoute,
  UpdatePostBySlugRoute
} from './content.routes'

export const getPosts: AppRouteHandler<GetPostsRoute> = async (c) => {
  const { limit, offset, type } = c.req.valid('query')

  const program = Effect.gen(function* () {
    const postService = yield* PostService
    return yield* postService.getAll({ limit, offset, type })
  })

  return runEffect<GetPostsRoute>(c, program)
}

export const getPostBySlug: AppRouteHandler<GetPostBySlugRoute> = async (c) => {
  const { slug } = c.req.valid('param')

  const program = Effect.gen(function* () {
    const postService = yield* PostService
    return yield* postService.getBySlug(slug)
  })

  return runEffect<GetPostBySlugRoute>(c, program)
}

export const getEditorialPosts: AppRouteHandler<GetEditorialPostsRoute> = async (c) => {
  const { limit, offset, tag } = c.req.valid('query')

  const program = Effect.gen(function* () {
    const postService = yield* PostService
    return yield* postService.getEditorials({ limit, offset, tag })
  })

  c.header('Cache-Control', 'public, max-age=60, stale-while-revalidate=300')
  return runEffect<GetEditorialPostsRoute>(c, program)
}

export const getEditorialPostBySlug: AppRouteHandler<GetEditorialPostBySlugRoute> = async (c) => {
  const { slug } = c.req.valid('param')

  const program = Effect.gen(function* () {
    const postService = yield* PostService
    return yield* postService.getEditorialBySlug(slug)
  })

  return runEffect<GetEditorialPostBySlugRoute>(c, program)
}

export const getMicroPosts: AppRouteHandler<GetMicroPostsRoute> = async (c) => {
  const { limit, offset } = c.req.valid('query')

  const program = Effect.gen(function* () {
    const postService = yield* PostService
    return yield* postService.getMicroPosts({ limit, offset })
  })

  return runEffect<GetMicroPostsRoute>(c, program)
}

export const getMicroPostBySlug: AppRouteHandler<GetMicroPostBySlugRoute> = async (c) => {
  const { slug } = c.req.valid('param')

  const program = Effect.gen(function* () {
    const postService = yield* PostService
    return yield* postService.getMicroPostBySlug(slug)
  })

  return runEffect<GetMicroPostBySlugRoute>(c, program)
}

export const createPost: AppRouteHandler<CreatePostRoute> = async (c) => {
  const { creatorIds, ...postData } = c.req.valid('json')
  const user = c.get('user')
  const finalCreatorIds = creatorIds?.length ? creatorIds : [user.id]

  const program = Effect.gen(function* () {
    const postService = yield* PostService
    return yield* postService.create(postData, finalCreatorIds)
  })

  return runEffect<CreatePostRoute>(c, program, HttpStatusCodes.CREATED)
}

export const updatePostBySlug: AppRouteHandler<UpdatePostBySlugRoute> = async (c) => {
  const { slug } = c.req.valid('param')
  const updateData = c.req.valid('json')
  const user = c.get('user')

  const program = Effect.gen(function* () {
    const postService = yield* PostService
    return yield* postService.update(slug, user.id, user.role || 'user', {
      ...updateData
    })
  })

  return runEffect<UpdatePostBySlugRoute>(c, program)
}

export const getPostsByTag: AppRouteHandler<GetPostsByTagRoute> = async (c) => {
  const { tag } = c.req.valid('param')
  const { limit, offset } = c.req.valid('query')

  const program = Effect.gen(function* () {
    const postService = yield* PostService
    return yield* postService.getByTag(tag, { limit, offset })
  })

  return runEffect<GetPostsByTagRoute>(c, program)
}

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
    return yield* audioService.getTags(type as 'mix' | 'track' | 'misc')
  }).pipe(Effect.withSpan('getAudioTags'))

  c.header('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400')
  return runEffect<GetAudioTagsRoute>(c, program)
}

export const getEditorialTags: AppRouteHandler<GetEditorialTagsRoute> = async (c) => {
  const program = Effect.gen(function* () {
    const postService = yield* PostService
    return yield* postService.getEditorialTags()
  }).pipe(Effect.withSpan('getEditorialTags'))

  c.header('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400')
  return runEffect<GetEditorialTagsRoute>(c, program)
}

export const getAudioByType: AppRouteHandler<GetAudioByTypeRoute> = async (c) => {
  const { type } = c.req.valid('param')
  const { limit, offset, tag } = c.req.valid('query')

  const program = Effect.gen(function* () {
    const audioService = yield* AudioService
    return yield* audioService.getByType(type as 'mix' | 'track' | 'misc', {
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
    return yield* audioService.getBySlug(type as 'mix' | 'track' | 'misc', slug)
  }).pipe(Effect.withSpan('getAudioBySlug'))

  return runEffect<GetAudioBySlugRoute>(c, program)
}

export const updateAudioBySlug: AppRouteHandler<UpdateAudioBySlugRoute> = async (c) => {
  const { type, slug } = c.req.valid('param')
  const updateData = c.req.valid('json')
  const user = c.get('user')

  const program = Effect.gen(function* () {
    const audioService = yield* AudioService
    return yield* audioService.update(
      type as 'mix' | 'track' | 'misc',
      slug,
      user.id,
      user.role || 'user',
      updateData
    )
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
