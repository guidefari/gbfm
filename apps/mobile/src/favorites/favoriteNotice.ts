import { Effect } from 'effect'

import { FavoriteEvent, type FavoriteNotice } from './favoriteState'

export const dismissFavoriteNoticeAfterDelay = (key: string, notice: FavoriteNotice) =>
  Effect.sleep('4 seconds').pipe(Effect.as(FavoriteEvent.NoticeDismissed({ key, id: notice.id })))
