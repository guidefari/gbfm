import { createRouter } from '@/lib/create-app'

import * as handlers from './auth.handlers'
import * as routes from './auth.routes'

const router = createRouter()
  .openapi(routes.updateProfile, handlers.updateProfile)
  .openapi(routes.getProfile, handlers.getProfile)
  .openapi(routes.getEmailPreferences, handlers.getEmailPreferences)
  .openapi(routes.updateEmailPreferences, handlers.updateEmailPreferences)

export default router
