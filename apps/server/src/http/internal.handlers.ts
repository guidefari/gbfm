import { Api } from '@gbfm/api/api'
import { AuthSession } from '@gbfm/api/middleware/auth'
import { Effect } from 'effect'
import { HttpApiBuilder } from 'effect/unstable/httpapi'

export const InternalHandlersLive = HttpApiBuilder.group(Api, 'internal', (handlers) =>
  handlers.handle('whoami', () =>
    Effect.gen(function* () {
      const { user } = yield* AuthSession
      return { userId: user.id, email: user.email }
    })
  )
)
