import { createRouter } from '@/lib/create-app'

import * as handlers from './profile.handlers'
import * as routes from './profile.routes'

const router = createRouter().openapi(
  routes.getPublicProfile,
  handlers.getPublicProfile
)

export default router
