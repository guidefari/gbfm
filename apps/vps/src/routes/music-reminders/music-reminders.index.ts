import { createRouter } from '@/lib/create-app'
import * as handlers from './music-reminders.handlers'
import * as routes from './music-reminders.routes'

const router = createRouter()
  .openapi(routes.createMusicReminder, handlers.createMusicReminder)
  .openapi(routes.getMusicReminders, handlers.getMusicReminders)
  .openapi(routes.updateMusicReminder, handlers.updateMusicReminder)
  .openapi(routes.deleteMusicReminder, handlers.deleteMusicReminder)

export default router
