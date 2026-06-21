import { createRouter } from '@/lib/create-app'

import * as handlers from './upload-multipart.handlers'
import * as routes from './upload-multipart.routes'

const router = createRouter()
  .openapi(routes.initMultipart, handlers.initMultipart)
  .openapi(routes.uploadPart, handlers.uploadPart)
  .openapi(routes.completeMultipart, handlers.completeMultipart)
  .openapi(routes.abortMultipart, handlers.abortMultipart)
  .openapi(routes.multipartStatus, handlers.multipartStatus)

export default router
