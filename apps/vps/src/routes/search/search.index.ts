import { createRouter } from '@/lib/create-app'

import * as handlers from './search.handlers'
import * as routes from './search.routes'

const router = createRouter().openapi(routes.searchContent, handlers.searchContent)

export default router
