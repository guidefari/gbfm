import { createRouter } from '@/lib/create-app'

import * as handlers from './content.handlers'
import * as routes from './content.routes'
import * as labelHandlers from './label.handlers'
import * as labelRoutes from './label.routes'

const router = createRouter()
  .openapi(routes.createPost, handlers.createPost)
  .openapi(routes.getPostsByTag, handlers.getPostsByTag)
  .openapi(routes.getAudioByType, handlers.getAudioByType)
  .openapi(routes.getAudioBySlug, handlers.getAudioBySlug)
  .openapi(routes.updateAudioBySlug, handlers.updateAudioBySlug)
  .openapi(routes.createMix, handlers.createMix)
  .openapi(routes.createAudio, handlers.createAudio)
  .openapi(routes.processMixUpload, handlers.processUpload)
  .openapi(labelRoutes.createLabel, labelHandlers.createLabel)
  .openapi(labelRoutes.getAllLabels, labelHandlers.getAllLabels)
  .openapi(labelRoutes.getLabelBySlug, labelHandlers.getLabelBySlug)
  .openapi(labelRoutes.updateLabelBySlug, labelHandlers.updateLabelBySlug)

export default router
