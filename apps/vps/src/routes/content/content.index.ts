import { createRouter } from '@/lib/create-app'

import * as handlers from './content.handlers'
import * as routes from './content.routes'

const router = createRouter()
  .openapi(routes.getAudioTags, handlers.getAudioTags)
  .openapi(routes.getAudioByType, handlers.getAudioByType)
  .openapi(routes.getAudioBySlug, handlers.getAudioBySlug)
  .openapi(routes.updateAudioBySlug, handlers.updateAudioBySlug)
  .openapi(routes.createMix, handlers.createMix)
  .openapi(routes.createAudio, handlers.createAudio)
  .openapi(routes.getMixQRPdf, handlers.getMixQRPdf)
  .openapi(routes.trackAudioPlay, handlers.trackAudioPlay)

export default router
