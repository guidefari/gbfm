import { createRouter } from '@/lib/create-app'

import { confirmInviteHandler, sendInviteHandler } from './invite.handlers'
import { confirmInvite, sendInvite } from './invite.routes'

const router = createRouter()
  .openapi(sendInvite, sendInviteHandler)
  .openapi(confirmInvite, confirmInviteHandler)

export default router
