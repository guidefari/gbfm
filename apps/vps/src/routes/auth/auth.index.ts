import { createRouter } from '@/lib/create-app'

import * as handlers from './auth.handlers'
import * as routes from './auth.routes'

const router = createRouter()
  .openapi(routes.signup, handlers.signup)
  .openapi(routes.signin, handlers.signin)
  .openapi(routes.forgotPassword, handlers.forgotPassword)
  .openapi(routes.resetPassword, handlers.resetPassword)
  .openapi(routes.refreshToken, handlers.refreshToken)
  .openapi(routes.createUser, handlers.createUser)
  .openapi(routes.listUsers, handlers.listUsers)
  .openapi(routes.updateProfile, handlers.updateProfile)
  .openapi(routes.getProfile, handlers.getProfile)

export default router
