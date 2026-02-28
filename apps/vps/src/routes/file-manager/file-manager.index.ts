import { createRouter } from '@/lib/create-app'

import * as handlers from './file-manager.handlers'
import * as routes from './file-manager.routes'

const router = createRouter()
  .openapi(routes.getConfig, handlers.getConfig)
  .openapi(routes.listObjects, handlers.listObjects)
  .openapi(routes.copyObject, handlers.copyObject)

export default router
