import { createRouter } from '@/lib/create-app'

import * as handlers from './user.handlers'
import * as routes from './user.routes'

const router = createRouter()
  .openapi(routes.updateProfile, handlers.updateProfile)
  .openapi(routes.getProfile, handlers.getProfile)
  .openapi(routes.getEmailPreferences, handlers.getEmailPreferences)
  .openapi(routes.updateEmailPreferences, handlers.updateEmailPreferences)
  .openapi(routes.getUserSubscriptions, handlers.getUserSubscriptions)

export default router
