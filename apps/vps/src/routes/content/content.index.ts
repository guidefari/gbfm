import { createRouter } from '@/lib/create-app'

import * as handlers from './content.handlers'
import * as routes from './content.routes'
import * as labelHandlers from './label.handlers'
import * as labelRoutes from './label.routes'
import * as releaseHandlers from './release.handlers'
import * as releaseRoutes from './release.routes'

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
  .openapi(labelRoutes.createLabel, labelHandlers.createLabel)
  .openapi(labelRoutes.getAllLabels, labelHandlers.getAllLabels)
  .openapi(labelRoutes.getLabelBySlug, labelHandlers.getLabelBySlug)
  .openapi(labelRoutes.updateLabelBySlug, labelHandlers.updateLabelBySlug)
  .openapi(releaseRoutes.createRelease, releaseHandlers.createRelease)
  .openapi(releaseRoutes.getReleasesByLabel, releaseHandlers.getReleasesByLabel)
  .openapi(releaseRoutes.getReleaseBySlug, releaseHandlers.getReleaseBySlug)
  .openapi(releaseRoutes.updateReleaseBySlug, releaseHandlers.updateReleaseBySlug)
  .openapi(releaseRoutes.deleteReleaseBySlug, releaseHandlers.deleteReleaseBySlug)

export default router
