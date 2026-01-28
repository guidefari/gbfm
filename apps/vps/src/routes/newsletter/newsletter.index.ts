import { createRouter } from '@/lib/create-app'

import * as handlers from './newsletter.handlers'
import * as routes from './newsletter.routes'

const router = createRouter().openapi(routes.subscribe, handlers.subscribe)

export default router
