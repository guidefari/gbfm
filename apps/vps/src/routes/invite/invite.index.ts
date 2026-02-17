import { createRouter } from '@/lib/create-app'

import { sendInviteHandler } from './invite.handlers'
import { sendInvite } from './invite.routes'

const router = createRouter().openapi(sendInvite, sendInviteHandler)

export default router
