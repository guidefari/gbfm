import { createRouter } from '@/lib/create-app'

import * as handlers from './resolve.handlers'
import * as routes from './resolve.routes'

const router = createRouter().openapi(routes.resolveSlug, handlers.resolveSlug)

export default router
