import { createRouter } from '@/lib/create-app'

import * as handlers from './upload.handlers'
import * as routes from './upload.routes'

const router = createRouter().openapi(routes.uploadFile, handlers.uploadFile)

export default router
