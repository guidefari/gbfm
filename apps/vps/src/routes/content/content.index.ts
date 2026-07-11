import { createRouter } from '@/lib/create-app'

import * as handlers from './content.handlers'
import * as routes from './content.routes'

const router = createRouter()
  .openapi(routes.getPosts, handlers.getPosts)
  .openapi(routes.getEditorialTags, handlers.getEditorialTags)
  .openapi(routes.getEditorialPosts, handlers.getEditorialPosts)
  .openapi(routes.getEditorialPostBySlug, handlers.getEditorialPostBySlug)
  .openapi(routes.getMicroPosts, handlers.getMicroPosts)
  .openapi(routes.getMicroPostBySlug, handlers.getMicroPostBySlug)
  .openapi(routes.getPostBySlug, handlers.getPostBySlug)
  .openapi(routes.createPost, handlers.createPost)
  .openapi(routes.updatePostBySlug, handlers.updatePostBySlug)
  .openapi(routes.getPostsByTag, handlers.getPostsByTag)
  .openapi(routes.getAudioTags, handlers.getAudioTags)
  .openapi(routes.getAudioByType, handlers.getAudioByType)
  .openapi(routes.getAudioBySlug, handlers.getAudioBySlug)
  .openapi(routes.updateAudioBySlug, handlers.updateAudioBySlug)
  .openapi(routes.createMix, handlers.createMix)
  .openapi(routes.createAudio, handlers.createAudio)
  .openapi(routes.getMixQRPdf, handlers.getMixQRPdf)
  .openapi(routes.trackAudioPlay, handlers.trackAudioPlay)

export default router
