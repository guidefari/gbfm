import { createRouter } from '@/lib/create-app'

import * as handlers from './user.handlers'
import * as routes from './user.routes'

const router = createRouter()
  .openapi(routes.updateProfile, handlers.updateProfile)
  .openapi(routes.getProfile, handlers.getProfile)
  .openapi(routes.getSocialLinks, handlers.getSocialLinks)
  .openapi(routes.replaceSocialLinks, handlers.replaceSocialLinks)
  .openapi(routes.getAdminUserSocialLinks, handlers.getAdminUserSocialLinks)
  .openapi(
    routes.replaceAdminUserSocialLinks,
    handlers.replaceAdminUserSocialLinks
  )
  .openapi(routes.updateAdminUserBio, handlers.updateAdminUserBio)
  .openapi(routes.getAdminUserBio, handlers.getAdminUserBio)
  .openapi(routes.getEmailPreferences, handlers.getEmailPreferences)
  .openapi(routes.updateEmailPreferences, handlers.updateEmailPreferences)
  .openapi(routes.getUserSubscriptions, handlers.getUserSubscriptions)
  .openapi(routes.listDjs, handlers.listDjs)
  .openapi(routes.searchUsers, handlers.searchUsers)

export default router
